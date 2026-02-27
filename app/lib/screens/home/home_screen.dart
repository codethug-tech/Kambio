import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../theme/app_theme.dart';
import '../../core/constants.dart';
import '../../widgets/listing_card.dart';
import '../../widgets/bcv_rate_banner.dart';

// Listings provider
final listingsProvider =
    FutureProvider.family<List<Map<String, dynamic>>, ListingFilter>((
      ref,
      filter,
    ) async {
      // Build filter stage (PostgrestFilterBuilder) before transform stage
      var q = Supabase.instance.client
          .from('listings')
          .select(
            '*, users(id, name, avatar_url, rating, trades_count), listing_photos(url, "order")',
          )
          .eq('status', 'active');

      if (filter.type != null) q = q.eq('type', filter.type!);
      if (filter.state != null) q = q.eq('state', filter.state!);
      if (filter.category != null) q = q.eq('category', filter.category!);
      if (filter.q != null && filter.q!.isNotEmpty) {
        q = q.or('title.ilike.%${filter.q!}%,offer_text.ilike.%${filter.q!}%');
      }

      final data = await q.order('created_at', ascending: false).limit(30);
      return List<Map<String, dynamic>>.from(data as List);
    });

class ListingFilter {
  final String? type, state, category, q;
  const ListingFilter({this.type, this.state, this.category, this.q});

  @override
  bool operator ==(Object other) =>
      other is ListingFilter &&
      other.type == type &&
      other.state == state &&
      other.category == category &&
      other.q == q;

  @override
  int get hashCode => Object.hash(type, state, category, q);
}

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int _tab = 0;
  String? _filterType, _filterState, _filterCategory;
  final _search = TextEditingController();
  String _q = '';
  String? _myProfileId; // users.id (profile UUID, not auth UID)

  @override
  void initState() {
    super.initState();
    _resolveProfileId();
  }

  Future<void> _resolveProfileId() async {
    final authUid = Supabase.instance.client.auth.currentUser?.id;
    if (authUid == null) return;
    final u = await Supabase.instance.client
        .from('users')
        .select('id')
        .eq('auth_id', authUid)
        .maybeSingle();
    if (mounted) setState(() => _myProfileId = u?['id'] as String?);
  }

  ListingFilter get _filter => ListingFilter(
    type: _filterType,
    state: _filterState,
    category: _filterCategory,
    q: _q,
  );

  @override
  Widget build(BuildContext context) {
    final listingsAsync = ref.watch(listingsProvider(_filter));

    final tabs = [
      _buildFeed(listingsAsync),
      const Center(
        child: Text('Chats', style: TextStyle(color: Colors.white)),
      ),
      const Center(
        child: Text('Favoritos', style: TextStyle(color: Colors.white)),
      ),
      const Center(
        child: Text('Perfil', style: TextStyle(color: Colors.white)),
      ),
    ];

    return Scaffold(
      body: SafeArea(child: tabs[_tab]),
      floatingActionButton: _tab == 0
          ? FloatingActionButton.extended(
              onPressed: () => context.go('/home/listing/new'),
              backgroundColor: KColors.green,
              foregroundColor: Colors.black,
              icon: const Icon(Icons.add),
              label: const Text(
                'Publicar',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
            )
          : null,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _tab,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home_rounded),
            label: 'Inicio',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.chat_bubble_rounded),
            label: 'Chats',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.favorite_rounded),
            label: 'Favoritos',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_rounded),
            label: 'Perfil',
          ),
        ],
        onTap: (i) {
          if (i == 1) {
            context.go('/home/chat');
          } else if (i == 2) {
            context.go('/home/favorites');
          } else if (i == 3) {
            if (_myProfileId != null) {
              context.go('/home/profile/$_myProfileId');
            } else {
              // Profile not yet resolved — resolve then navigate
              unawaited(
                _resolveProfileId().then((_) {
                  if (_myProfileId != null && mounted) {
                    // ignore: use_build_context_synchronously
                    context.go('/home/profile/$_myProfileId');
                  }
                }),
              );
            }
          } else {
            setState(() => _tab = i);
          }
        },
      ),
    );
  }

  Widget _buildFeed(AsyncValue<List<Map<String, dynamic>>> listingsAsync) {
    return RefreshIndicator(
      color: KColors.green,
      backgroundColor: KColors.surface,
      onRefresh: () async {
        // Invalidate the provider so it re-fetches from Supabase
        ref.invalidate(listingsProvider(_filter));
        // Wait a tiny bit just for the UI feel
        await Future.delayed(const Duration(milliseconds: 500));
      },
      child: CustomScrollView(
        slivers: [
          // App bar with search
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Text(
                        'K',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                          color: KColors.green,
                        ),
                      ),
                      const Text(
                        'ambio',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                      const Spacer(),
                      IconButton(
                        icon: const Icon(
                          Icons.settings_outlined,
                          color: KColors.textSecondary,
                        ),
                        onPressed: () => context.go('/home/settings'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Intercambia. Negocia. Confía.',
                    style: KTextStyles.bodySmall,
                  ),
                  const SizedBox(height: 12),
                  // BCV Exchange Rates Banner
                  const BcvRateBanner(),
                  // Search bar
                  TextField(
                    controller: _search,
                    style: KTextStyles.body,
                    onChanged: (v) => setState(() => _q = v),
                    decoration: InputDecoration(
                      hintText: 'Buscar ofertas...',
                      prefixIcon: const Icon(
                        Icons.search,
                        color: KColors.textHint,
                      ),
                      suffixIcon: _q.isNotEmpty
                          ? IconButton(
                              icon: const Icon(
                                Icons.clear,
                                color: KColors.textHint,
                                size: 18,
                              ),
                              onPressed: () {
                                _search.clear();
                                setState(() => _q = '');
                              },
                            )
                          : null,
                    ),
                  ),
                  const SizedBox(height: 12),
                  // Type filter chips
                  SizedBox(
                    height: 36,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        _chip('Todos', null),
                        _chip('Cambio Bs↔\$', 'cambio'),
                        _chip('Trueque', 'trueque'),
                        _chip('Servicio', 'servicio'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  // Category + State filters
                  Row(
                    children: [
                      Expanded(
                        child: _dropdown(
                          'Categoría',
                          AppConfig.categories,
                          _filterCategory,
                          (v) => setState(() => _filterCategory = v),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _dropdown(
                          'Estado',
                          AppConfig.states,
                          _filterState,
                          (v) => setState(() => _filterState = v),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  if (_filterCategory != null ||
                      _filterState != null ||
                      _filterType != null)
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: () => setState(() {
                          _filterCategory = _filterState = _filterType = null;
                        }),
                        child: const Text('Limpiar filtros'),
                      ),
                    ),
                  const SizedBox(height: 8),
                ],
              ),
            ),
          ),
          // Listing grid
          listingsAsync.when(
            loading: () => const SliverFillRemaining(
              child: Center(
                child: CircularProgressIndicator(color: KColors.green),
              ),
            ),
            error: (e, _) => SliverFillRemaining(
              child: Center(child: Text('Error: $e', style: KTextStyles.body)),
            ),
            data: (listings) => listings.isEmpty
                ? SliverFillRemaining(
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.inbox_outlined,
                            color: KColors.textHint,
                            size: 64,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'No hay ofertas disponibles',
                            style: KTextStyles.body.copyWith(
                              color: KColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                : SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    sliver: SliverGrid(
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            mainAxisSpacing: 12,
                            crossAxisSpacing: 12,
                            childAspectRatio: 0.75,
                          ),
                      delegate: SliverChildBuilderDelegate(
                        (ctx, i) => ListingCard(listing: listings[i]),
                        childCount: listings.length,
                      ),
                    ),
                  ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 80)),
        ],
      ),
    );
  }

  Widget _chip(String label, String? value) {
    final selected = _filterType == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) =>
            setState(() => _filterType = selected ? null : value),
        labelStyle: KTextStyles.bodySmall.copyWith(
          color: selected ? KColors.green : KColors.textSecondary,
          fontWeight: selected ? FontWeight.w700 : FontWeight.w400,
        ),
        selectedColor: KColors.green.withValues(alpha: 0.15),
        backgroundColor: KColors.surface2,
        side: BorderSide(
          color: selected
              ? KColors.green.withValues(alpha: 0.5)
              : Colors.transparent,
        ),
      ),
    );
  }

  Widget _dropdown(
    String hint,
    List<String> items,
    String? value,
    ValueChanged<String?> onChanged,
  ) {
    return Container(
      height: 40,
      decoration: BoxDecoration(
        color: KColors.surface2,
        borderRadius: BorderRadius.circular(10),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 10),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          hint: Text(hint, style: KTextStyles.bodySmall),
          style: KTextStyles.bodySmall.copyWith(color: KColors.textPrimary),
          dropdownColor: KColors.surface2,
          isExpanded: true,
          icon: const Icon(
            Icons.expand_more,
            color: KColors.textSecondary,
            size: 18,
          ),
          items: [
            DropdownMenuItem(
              value: null,
              child: Text('Todos', style: KTextStyles.bodySmall),
            ),
            ...items.map(
              (s) => DropdownMenuItem(
                value: s,
                child: Text(s, style: KTextStyles.bodySmall),
              ),
            ),
          ],
          onChanged: onChanged,
        ),
      ),
    );
  }
}
