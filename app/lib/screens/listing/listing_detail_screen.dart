import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../theme/app_theme.dart';
import '../../widgets/k_button.dart';

class ListingDetailScreen extends StatefulWidget {
  final String id;
  const ListingDetailScreen({super.key, required this.id});

  @override
  State<ListingDetailScreen> createState() => _ListingDetailScreenState();
}

class _ListingDetailScreenState extends State<ListingDetailScreen> {
  Map<String, dynamic>? _listing;
  bool _loading = true;
  bool _isFav = false;
  String? _myUserId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final authUid = Supabase.instance.client.auth.currentUser?.id;
    final myUser = authUid != null
        ? await Supabase.instance.client
              .from('users')
              .select('id')
              .eq('auth_id', authUid)
              .maybeSingle()
        : null;
    _myUserId = myUser?['id'] as String?;

    final data = await Supabase.instance.client
        .from('listings')
        .select(
          '*, users(id, name, avatar_url, rating, trades_count, city, state, bio), listing_photos(url, "order")',
        )
        .eq('id', widget.id)
        .single();

    // Check favorite
    bool isFav = false;
    if (_myUserId != null) {
      final fav = await Supabase.instance.client
          .from('favorites')
          .select('id')
          .eq('user_id', _myUserId!)
          .eq('listing_id', widget.id)
          .maybeSingle();
      isFav = fav != null;
    }

    if (mounted) {
      setState(() {
        _listing = data;
        _loading = false;
        _isFav = isFav;
      });
    }
  }

  Future<void> _toggleFav() async {
    if (_myUserId == null) return;
    if (_isFav) {
      await Supabase.instance.client
          .from('favorites')
          .delete()
          .eq('user_id', _myUserId!)
          .eq('listing_id', widget.id);
    } else {
      await Supabase.instance.client.from('favorites').insert({
        'user_id': _myUserId!,
        'listing_id': widget.id,
      });
    }
    setState(() => _isFav = !_isFav);
  }

  Future<void> _contact() async {
    if (_myUserId == null) {
      context.go('/login');
      return;
    }
    final thread = await Supabase.instance.client
        .from('chat_threads')
        .upsert({
          'listing_id': widget.id,
          'buyer_id': _myUserId!,
          'seller_id': _listing!['user_id'],
        }, onConflict: 'listing_id,buyer_id')
        .select()
        .single();
    if (mounted) context.go('/home/chat/${thread['id']}');
  }

  Future<void> _reportListing() async {
    if (_myUserId == null) {
      context.go('/login');
      return;
    }

    const reasonOptions = [
      ('scam', '\ud83d\udcb8 Intento de estafa'),
      ('spam', '\ud83d\udce2 Spam o publicidad'),
      ('prohibited', '\ud83d\udeab Contenido prohibido'),
      ('fake', '\ud83c\udfad Anuncio falso'),
      ('other', '\u26a0\ufe0f Otro motivo'),
    ];

    String selectedReason = 'other';
    bool submitting = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: KColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) {
        return StatefulBuilder(
          builder: (sheetCtx, setSheet) {
            return Padding(
              padding: EdgeInsets.fromLTRB(
                20,
                16,
                20,
                20 + MediaQuery.of(sheetCtx).viewInsets.bottom,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 38,
                      height: 4,
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: KColors.divider,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  Row(
                    children: [
                      const Icon(
                        Icons.flag_rounded,
                        color: KColors.error,
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Text('Reportar esta oferta', style: KTextStyles.h3),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Ay\u00fadanos a mantener el marketplace seguro.',
                    style: KTextStyles.bodySmall,
                  ),
                  const SizedBox(height: 12),
                  ...reasonOptions.map(
                    (r) => GestureDetector(
                      onTap: () => setSheet(() => selectedReason = r.$1),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          children: [
                            Icon(
                              selectedReason == r.$1
                                  ? Icons.radio_button_checked
                                  : Icons.radio_button_unchecked,
                              color: selectedReason == r.$1
                                  ? KColors.green
                                  : KColors.textSecondary,
                              size: 20,
                            ),
                            const SizedBox(width: 10),
                            Text(r.$2, style: KTextStyles.body),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: submitting
                          ? null
                          : () async {
                              setSheet(() => submitting = true);
                              try {
                                await Supabase.instance.client
                                    .from('reports')
                                    .insert({
                                      'reporter_id': _myUserId,
                                      'target_type': 'listing',
                                      'target_id': widget.id,
                                      'reason': selectedReason,
                                    });
                                if (sheetCtx.mounted) {
                                  Navigator.pop(sheetCtx);
                                }
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text(
                                        'Reporte enviado. \u00a1Gracias por ayudar!',
                                      ),
                                      backgroundColor: KColors.green,
                                    ),
                                  );
                                }
                              } catch (e) {
                                setSheet(() => submitting = false);
                                if (sheetCtx.mounted) {
                                  ScaffoldMessenger.of(sheetCtx).showSnackBar(
                                    SnackBar(
                                      content: Text('Error: $e'),
                                      backgroundColor: KColors.error,
                                    ),
                                  );
                                }
                              }
                            },
                      child: submitting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.black,
                              ),
                            )
                          : const Text('Enviar reporte'),
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _deleteListing() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: KColors.surface,
        title: const Text(
          'Eliminar oferta',
          style: TextStyle(color: Colors.white),
        ),
        content: const Text(
          '¿Estás seguro de que quieres eliminar esta oferta?',
          style: TextStyle(color: KColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text(
              'Cancelar',
              style: TextStyle(color: KColors.textSecondary),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(
              'Eliminar',
              style: TextStyle(color: KColors.error),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    if (!mounted) return;

    // Attempt to parse out storage file paths from public URLs and delete them
    final photos = (_listing!['listing_photos'] as List?) ?? [];
    if (photos.isNotEmpty) {
      final List<String> paths = [];
      for (var p in photos) {
        final url = p['url'] as String;
        final match = RegExp(
          r'/storage/v1/object/public/[^/]+/(.+)$',
        ).firstMatch(url);
        if (match != null) {
          paths.add(match.group(1)!);
        }
      }
      if (paths.isNotEmpty) {
        try {
          await Supabase.instance.client.storage
              .from('listing-photos')
              .remove(paths);
        } catch (_) {}
      }
    }

    await Supabase.instance.client
        .from('listings')
        .delete()
        .eq('id', widget.id);
    if (mounted) {
      context.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: KColors.green)),
      );
    }
    if (_listing == null) {
      return const Scaffold(body: Center(child: Text('No encontrado')));
    }

    final photos = (_listing!['listing_photos'] as List?) ?? [];
    final user = _listing!['users'] as Map<String, dynamic>?;
    final isOwner = _myUserId == _listing!['user_id'];

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          // Photo header
          SliverAppBar(
            expandedHeight: 280,
            pinned: true,
            backgroundColor: KColors.bg,
            actions: [
              IconButton(
                icon: Icon(
                  _isFav ? Icons.favorite : Icons.favorite_border,
                  color: _isFav ? KColors.error : KColors.textSecondary,
                ),
                onPressed: _toggleFav,
              ),
              if (!isOwner)
                IconButton(
                  icon: const Icon(Icons.flag_outlined),
                  color: KColors.textSecondary,
                  tooltip: 'Reportar',
                  onPressed: _reportListing,
                ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: photos.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: photos[0]['url'],
                      fit: BoxFit.cover,
                    )
                  : Container(
                      color: KColors.surface2,
                      child: const Icon(
                        Icons.image_outlined,
                        color: KColors.textHint,
                        size: 80,
                      ),
                    ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Type badge
                  _typeBadge(_listing!['type'] ?? ''),
                  const SizedBox(height: 10),
                  Text(_listing!['title'] ?? '', style: KTextStyles.h2),
                  const SizedBox(height: 16),

                  // Offer / Want cards
                  _offerCard(
                    '🎁 Ofrezco',
                    _listing!['offer_text'] ?? '',
                    KColors.surface,
                  ),
                  const SizedBox(height: 8),
                  _offerCard(
                    '🎯 Quiero',
                    _listing!['want_text'] ?? '',
                    KColors.green.withValues(alpha: 0.08),
                  ),

                  if (_listing!['description'] != null) ...[
                    const SizedBox(height: 16),
                    Text('Descripción', style: KTextStyles.label),
                    const SizedBox(height: 6),
                    Text(
                      _listing!['description'],
                      style: KTextStyles.body.copyWith(
                        color: KColors.textSecondary,
                      ),
                    ),
                  ],

                  const SizedBox(height: 20),
                  const Divider(color: KColors.divider),
                  const SizedBox(height: 16),

                  // Seller info
                  if (user != null) ...[
                    Text('Vendedor', style: KTextStyles.label),
                    const SizedBox(height: 12),
                    GestureDetector(
                      onTap: () => context.go('/home/profile/${user['id']}'),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 24,
                            backgroundColor: KColors.surface2,
                            backgroundImage: user['avatar_url'] != null
                                ? CachedNetworkImageProvider(user['avatar_url'])
                                : null,
                            child: user['avatar_url'] == null
                                ? Text(
                                    (user['name'] as String)
                                        .substring(0, 1)
                                        .toUpperCase(),
                                    style: KTextStyles.h3,
                                  )
                                : null,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(user['name'] ?? '', style: KTextStyles.h3),
                                const SizedBox(height: 2),
                                Row(
                                  children: [
                                    RatingBarIndicator(
                                      rating:
                                          (user['rating'] as num?)
                                              ?.toDouble() ??
                                          0,
                                      itemSize: 14,
                                      itemBuilder: (_, _) => const Icon(
                                        Icons.star,
                                        color: KColors.warning,
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      '${user['trades_count'] ?? 0} intercambios',
                                      style: KTextStyles.bodySmall,
                                    ),
                                  ],
                                ),
                                if (user['city'] != null)
                                  Text(
                                    '📍 ${user['city']}, ${user['state'] ?? ''}',
                                    style: KTextStyles.bodySmall,
                                  ),
                              ],
                            ),
                          ),
                          const Icon(
                            Icons.chevron_right,
                            color: KColors.textSecondary,
                          ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 100),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: Container(
        color: KColors.bg,
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: isOwner
            ? Row(
                children: [
                  Expanded(
                    child: KButton(
                      label: 'Eliminar',
                      outlined: true,
                      color: KColors.error,
                      onPressed: _deleteListing,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: KButton(
                      label: 'Editar',
                      onPressed: () =>
                          context.go('/home/listing/${widget.id}/edit'),
                    ),
                  ),
                ],
              )
            : KButton(
                label: 'Contactar vendedor',
                icon: Icons.chat_bubble_rounded,
                onPressed: _contact,
              ),
      ),
    );
  }

  Widget _typeBadge(String type) {
    final (label, color) = switch (type) {
      'cambio' => ('Cambio Bs ↔ USD', KColors.blue),
      'trueque' => ('Trueque de bienes', KColors.green),
      'servicio' => ('Servicio por pago', const Color(0xFFFF6E40)),
      _ => ('Otro', KColors.textHint),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }

  Widget _offerCard(String title, String value, Color bg) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: KTextStyles.bodySmall),
          const SizedBox(height: 4),
          Text(value, style: KTextStyles.h3),
        ],
      ),
    );
  }
}
