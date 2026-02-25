import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../theme/app_theme.dart';
import '../../widgets/listing_card.dart';
import 'edit_profile_screen.dart';

class ProfileScreen extends StatefulWidget {
  final String userId;
  const ProfileScreen({super.key, required this.userId});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  Map<String, dynamic>? _user;
  List<Map<String, dynamic>> _listings = [];
  List<Map<String, dynamic>> _ratings = [];
  String? _myUserId;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    _load();
  }

  Future<void> _load() async {
    final authUid = Supabase.instance.client.auth.currentUser?.id;
    final me = authUid != null
        ? await Supabase.instance.client
              .from('users')
              .select('id')
              .eq('auth_id', authUid)
              .maybeSingle()
        : null;
    _myUserId = me?['id'];

    final userRaw = await Supabase.instance.client
        .from('users')
        .select('*')
        .eq('id', widget.userId)
        .single();

    final listingsRaw = await Supabase.instance.client
        .from('listings')
        .select('*, listing_photos(url)')
        .eq('user_id', widget.userId)
        .eq('status', 'active');

    final ratingsRaw = await Supabase.instance.client
        .from('ratings')
        .select('*, rater:rater_id(id,name,avatar_url)')
        .eq('rated_id', widget.userId)
        .order('created_at', ascending: false);

    if (mounted) {
      setState(() {
        _user = userRaw;
        _listings = List<Map<String, dynamic>>.from(listingsRaw as List);
        _ratings = List<Map<String, dynamic>>.from(ratingsRaw as List);
        _loading = false;
      });
    }
  }

  bool get _isMe => _myUserId == widget.userId;

  // ── Rate user bottom sheet ────────────────────────────────────────────────
  Future<void> _showRateSheet() async {
    double stars = 3;
    final commentCtrl = TextEditingController();

    // Find a completed trade between the two users (required by backend)
    final tradesRes = await Supabase.instance.client
        .from('trades')
        .select('id')
        .eq('status', 'completed')
        .or('buyer_id.eq.$_myUserId,seller_id.eq.$_myUserId')
        .or('buyer_id.eq.${widget.userId},seller_id.eq.${widget.userId}')
        .limit(1)
        .maybeSingle();

    if (!mounted) return;

    if (tradesRes == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Solo puedes valorar a usuarios con quienes hayas completado un intercambio.',
          ),
          backgroundColor: KColors.error,
        ),
      );
      return;
    }

    final tradeId = tradesRes['id'] as String;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: KColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 24,
                right: 24,
                top: 24,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Handle
                  Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: KColors.divider,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text('Valorar a ${_user!['name']}', style: KTextStyles.h3),
                  const SizedBox(height: 4),
                  Text(
                    'Comparte tu experiencia con este usuario',
                    style: KTextStyles.bodySmall,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),

                  // Star picker
                  RatingBar.builder(
                    initialRating: stars,
                    minRating: 1,
                    allowHalfRating: false,
                    itemCount: 5,
                    itemSize: 40,
                    itemBuilder: (_, _) =>
                        const Icon(Icons.star, color: KColors.warning),
                    onRatingUpdate: (v) => setSheetState(() => stars = v),
                  ),
                  const SizedBox(height: 24),

                  // Comment
                  TextField(
                    controller: commentCtrl,
                    maxLines: 3,
                    maxLength: 300,
                    style: KTextStyles.body,
                    decoration: InputDecoration(
                      hintText: 'Deja un comentario (opcional)...',
                      hintStyle: KTextStyles.bodySmall,
                      filled: true,
                      fillColor: KColors.surface2,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                      counterStyle: KTextStyles.bodySmall,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Submit
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: KColors.green,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onPressed: () async {
                        Navigator.pop(ctx);
                        await _submitRating(
                          tradeId,
                          stars.toInt(),
                          commentCtrl.text.trim(),
                        );
                      },
                      child: Text(
                        'Enviar valoración',
                        style: KTextStyles.label,
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _submitRating(String tradeId, int score, String comment) async {
    try {
      await Supabase.instance.client.from('ratings').insert({
        'trade_id': tradeId,
        'rater_id': _myUserId,
        'rated_id': widget.userId,
        'score': score,
        if (comment.isNotEmpty) 'comment': comment,
      });

      // Recalculate average rating on users row
      final all = await Supabase.instance.client
          .from('ratings')
          .select('score')
          .eq('rated_id', widget.userId);
      final scores = (all as List).map((r) => (r['score'] as num).toDouble());
      if (scores.isNotEmpty) {
        final avg = scores.reduce((a, b) => a + b) / scores.length;
        await Supabase.instance.client
            .from('users')
            .update({'rating': avg})
            .eq('id', widget.userId);
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('¡Valoración enviada!'),
            backgroundColor: KColors.green,
          ),
        );
        _load(); // refresh
      }
    } catch (e) {
      if (mounted) {
        final msg = e.toString().contains('23505')
            ? 'Ya valoraste este intercambio.'
            : 'Error al enviar valoración: $e';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(msg), backgroundColor: KColors.error),
        );
      }
    }
  }

  // ── Edit profile ──────────────────────────────────────────────────────────
  Future<void> _openEdit() async {
    final refreshed = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => EditProfileScreen(user: _user!)),
    );
    if (refreshed == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: KColors.green)),
      );
    }
    if (_user == null) {
      return const Scaffold(body: Center(child: Text('Usuario no encontrado')));
    }

    return Scaffold(
      body: NestedScrollView(
        headerSliverBuilder: (ctx, _) => [
          SliverAppBar(
            expandedHeight: 220,
            pinned: true,
            backgroundColor: KColors.bg,
            actions: [
              if (_isMe)
                IconButton(
                  icon: const Icon(Icons.edit_outlined),
                  tooltip: 'Editar perfil',
                  onPressed: _openEdit,
                ),
              if (_isMe)
                IconButton(
                  icon: const Icon(Icons.logout),
                  onPressed: () async {
                    await Supabase.instance.client.auth.signOut();
                    if (context.mounted) context.go('/login');
                  },
                ),
              if (!_isMe && _myUserId != null)
                IconButton(
                  icon: const Icon(Icons.star_outline),
                  tooltip: 'Valorar usuario',
                  onPressed: _showRateSheet,
                ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const SizedBox(height: 48),
                  // Avatar (tappable to edit for own profile)
                  GestureDetector(
                    onTap: _isMe ? _openEdit : null,
                    child: Stack(
                      alignment: Alignment.bottomRight,
                      children: [
                        CircleAvatar(
                          radius: 44,
                          backgroundColor: KColors.surface2,
                          backgroundImage: _user!['avatar_url'] != null
                              ? CachedNetworkImageProvider(_user!['avatar_url'])
                              : null,
                          child: _user!['avatar_url'] == null
                              ? Text(
                                  (_user!['name'] as String)
                                      .substring(0, 1)
                                      .toUpperCase(),
                                  style: KTextStyles.h1,
                                )
                              : null,
                        ),
                        if (_isMe)
                          Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: KColors.green,
                              shape: BoxShape.circle,
                              border: Border.all(color: KColors.bg, width: 1.5),
                            ),
                            child: const Icon(
                              Icons.camera_alt,
                              size: 12,
                              color: Colors.black,
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(_user!['name'] ?? '', style: KTextStyles.h3),
                  if (_user!['bio'] != null &&
                      (_user!['bio'] as String).isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Text(
                        _user!['bio'],
                        style: KTextStyles.bodySmall,
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                  if (_user!['city'] != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      '📍 ${_user!['city']}, ${_user!['state'] ?? ''}',
                      style: KTextStyles.bodySmall,
                    ),
                  ],
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      RatingBarIndicator(
                        rating: (_user!['rating'] as num?)?.toDouble() ?? 0,
                        itemSize: 16,
                        itemBuilder: (_, _) =>
                            const Icon(Icons.star, color: KColors.warning),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${_user!['trades_count'] ?? 0} intercambios',
                        style: KTextStyles.bodySmall,
                      ),
                    ],
                  ),
                  // Rate button for other users (visible, below stars)
                  if (!_isMe && _myUserId != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: GestureDetector(
                        onTap: _showRateSheet,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: KColors.green.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: KColors.green, width: 1),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.star,
                                color: KColors.green,
                                size: 14,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'Valorar',
                                style: KTextStyles.label.copyWith(
                                  color: KColors.green,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            bottom: TabBar(
              controller: _tabs,
              indicatorColor: KColors.green,
              labelColor: KColors.green,
              unselectedLabelColor: KColors.textSecondary,
              tabs: const [
                Tab(text: 'Ofertas'),
                Tab(text: 'Valoraciones'),
              ],
            ),
          ),
        ],
        body: TabBarView(
          controller: _tabs,
          children: [
            // Listings tab
            _listings.isEmpty
                ? Center(
                    child: Text(
                      'Sin ofertas activas',
                      style: KTextStyles.body.copyWith(
                        color: KColors.textSecondary,
                      ),
                    ),
                  )
                : GridView.builder(
                    padding: const EdgeInsets.all(16),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          mainAxisSpacing: 12,
                          crossAxisSpacing: 12,
                          childAspectRatio: 0.75,
                        ),
                    itemCount: _listings.length,
                    itemBuilder: (_, i) => ListingCard(listing: _listings[i]),
                  ),
            // Ratings tab
            _ratings.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.star_border_rounded,
                          size: 48,
                          color: KColors.textHint,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Sin valoraciones aún',
                          style: KTextStyles.body.copyWith(
                            color: KColors.textSecondary,
                          ),
                        ),
                        if (!_isMe && _myUserId != null) ...[
                          const SizedBox(height: 12),
                          GestureDetector(
                            onTap: _showRateSheet,
                            child: Text(
                              '¡Sé el primero en valorar!',
                              style: KTextStyles.label.copyWith(
                                color: KColors.green,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _ratings.length,
                    separatorBuilder: (_, _) =>
                        const Divider(color: KColors.divider),
                    itemBuilder: (_, i) {
                      final r = _ratings[i];
                      final rater = r['rater'] as Map?;
                      return ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: CircleAvatar(
                          backgroundColor: KColors.surface2,
                          backgroundImage: rater?['avatar_url'] != null
                              ? CachedNetworkImageProvider(rater!['avatar_url'])
                              : null,
                          child: rater?['avatar_url'] == null
                              ? Text(
                                  (rater?['name'] as String? ?? 'U')
                                      .substring(0, 1)
                                      .toUpperCase(),
                                )
                              : null,
                        ),
                        title: Row(
                          children: [
                            Text(
                              rater?['name'] ?? 'Usuario',
                              style: KTextStyles.label,
                            ),
                            const SizedBox(width: 8),
                            RatingBarIndicator(
                              rating: (r['score'] as num).toDouble(),
                              itemSize: 14,
                              itemBuilder: (_, _) => const Icon(
                                Icons.star,
                                color: KColors.warning,
                              ),
                            ),
                          ],
                        ),
                        subtitle: r['comment'] != null
                            ? Text(r['comment'], style: KTextStyles.bodySmall)
                            : null,
                      );
                    },
                  ),
          ],
        ),
      ),
    );
  }
}
