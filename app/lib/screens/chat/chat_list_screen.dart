import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:timeago/timeago.dart' as timeago;
import '../../theme/app_theme.dart';

class ChatListScreen extends StatefulWidget {
  const ChatListScreen({super.key});

  @override
  State<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends State<ChatListScreen> {
  List<Map<String, dynamic>> _threads = [];
  String? _myUserId;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final authUid = Supabase.instance.client.auth.currentUser?.id;
    if (authUid == null) return;
    final u = await Supabase.instance.client
        .from('users')
        .select('id')
        .eq('auth_id', authUid)
        .maybeSingle();
    _myUserId = u?['id'];
    if (_myUserId == null) return;

    final data = await Supabase.instance.client
        .from('chat_threads')
        .select(
          '*, listing:listing_id(id, title), buyer:buyer_id(id,name,avatar_url), seller:seller_id(id,name,avatar_url)',
        )
        .or('buyer_id.eq.$_myUserId,seller_id.eq.$_myUserId')
        .order('created_at', ascending: false);

    if (mounted) {
      setState(() {
        _threads = List<Map<String, dynamic>>.from(data as List);
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mensajes')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: KColors.green))
          : _threads.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.chat_bubble_outline,
                    color: KColors.textHint,
                    size: 64,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Ningún mensaje aún',
                    style: KTextStyles.body.copyWith(
                      color: KColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Contacta a un vendedor desde una oferta',
                    style: KTextStyles.bodySmall,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            )
          : RefreshIndicator(
              color: KColors.green,
              onRefresh: _load,
              child: ListView.separated(
                itemCount: _threads.length,
                separatorBuilder: (_, _) =>
                    const Divider(color: KColors.divider, height: 1),
                itemBuilder: (_, i) {
                  final t = _threads[i];
                  final buyer = t['buyer'] as Map?;
                  final seller = t['seller'] as Map?;
                  final other = _myUserId == buyer?['id'] ? seller : buyer;
                  final listing = t['listing'] as Map?;

                  return ListTile(
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 6,
                    ),
                    leading: CircleAvatar(
                      radius: 24,
                      backgroundColor: KColors.surface2,
                      backgroundImage: other?['avatar_url'] != null
                          ? CachedNetworkImageProvider(other!['avatar_url'])
                          : null,
                      child: other?['avatar_url'] == null
                          ? Text(
                              (other?['name'] as String? ?? 'U')
                                  .substring(0, 1)
                                  .toUpperCase(),
                              style: KTextStyles.h3,
                            )
                          : null,
                    ),
                    title: Text(
                      other?['name'] ?? 'Usuario',
                      style: KTextStyles.label,
                    ),
                    subtitle: Text(
                      listing?['title'] ?? '',
                      style: KTextStyles.bodySmall,
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: Text(
                      timeago.format(
                        DateTime.parse(t['created_at']),
                        locale: 'es',
                      ),
                      style: KTextStyles.caption,
                    ),
                    onTap: () => context.go('/home/chat/${t['id']}'),
                  );
                },
              ),
            ),
    );
  }
}
