import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../theme/app_theme.dart';
import '../../widgets/listing_card.dart';

class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  List<Map<String, dynamic>> _favs = [];
  bool _loading = true;
  String? _myUserId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final authUid = Supabase.instance.client.auth.currentUser?.id;
    final u = authUid != null
        ? await Supabase.instance.client
              .from('users')
              .select('id')
              .eq('auth_id', authUid)
              .maybeSingle()
        : null;
    _myUserId = u?['id'];
    if (_myUserId == null) {
      setState(() => _loading = false);
      return;
    }

    final data = await Supabase.instance.client
        .from('favorites')
        .select(
          'listing:listing_id(*, users(id,name,avatar_url,rating), listing_photos(url))',
        )
        .eq('user_id', _myUserId!)
        .order('created_at', ascending: false);

    if (mounted) {
      setState(() {
        _favs = List<Map<String, dynamic>>.from(
          (data as List).map((f) => f['listing'] as Map<String, dynamic>),
        );
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Favoritos')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: KColors.green))
          : _favs.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.favorite_border,
                    color: KColors.textHint,
                    size: 64,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Sin favoritos aún',
                    style: KTextStyles.body.copyWith(
                      color: KColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Guarda ofertas tocando ♥ en el detalle',
                    style: KTextStyles.bodySmall,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            )
          : RefreshIndicator(
              color: KColors.green,
              onRefresh: _load,
              child: GridView.builder(
                padding: const EdgeInsets.all(16),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 0.75,
                ),
                itemCount: _favs.length,
                itemBuilder: (_, i) => ListingCard(listing: _favs[i]),
              ),
            ),
    );
  }
}
