import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:timeago/timeago.dart' as timeago;
import '../../theme/app_theme.dart';

class ChatScreen extends StatefulWidget {
  final String threadId;
  const ChatScreen({super.key, required this.threadId});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _msg = TextEditingController();
  final _scroll = ScrollController();
  List<Map<String, dynamic>> _messages = [];
  Map<String, dynamic>? _thread;
  String? _myUserId;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final authUid = Supabase.instance.client.auth.currentUser?.id;
    if (authUid == null) {
      context.go('/login');
      return;
    }
    final u = await Supabase.instance.client
        .from('users')
        .select('id')
        .eq('auth_id', authUid)
        .maybeSingle();
    _myUserId = u?['id'];

    // Load thread
    final thread = await Supabase.instance.client
        .from('chat_threads')
        .select(
          '*, listing:listing_id(id,title), buyer:buyer_id(id,name,avatar_url), seller:seller_id(id,name,avatar_url)',
        )
        .eq('id', widget.threadId)
        .single();
    if (mounted) setState(() => _thread = thread);

    // Load messages
    await _loadMessages();

    // Subscribe to realtime
    Supabase.instance.client
        .channel('chat_${widget.threadId}')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'chat_messages',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'thread_id',
            value: widget.threadId,
          ),
          callback: (payload) async {
            await _loadMessages();
            _scrollBottom();
          },
        )
        .subscribe();
  }

  Future<void> _loadMessages() async {
    final data = await Supabase.instance.client
        .from('chat_messages')
        .select('*, sender:sender_id(id, name, avatar_url)')
        .eq('thread_id', widget.threadId)
        .order('created_at', ascending: true);
    if (mounted) {
      setState(() => _messages = List<Map<String, dynamic>>.from(data as List));
    }
  }

  void _scrollBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _send() async {
    final text = _msg.text.trim();
    if (text.isEmpty || _myUserId == null) return;
    setState(() => _sending = true);
    _msg.clear();
    await Supabase.instance.client.from('chat_messages').insert({
      'thread_id': widget.threadId,
      'sender_id': _myUserId!,
      'text': text,
    });
    setState(() => _sending = false);
  }

  Future<void> _markTrade() async {
    // Create or update trade
    final listing = _thread?['listing'];
    if (listing == null || _myUserId == null) return;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: KColors.surface,
        title: Text('Marcar como completado', style: KTextStyles.h3),
        content: Text(
          '¿Confirmas que el intercambio se realizó con éxito?',
          style: KTextStyles.body.copyWith(color: KColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              // Upsert trade as completed
              final buyer = _thread!['buyer'] as Map<String, dynamic>;
              final seller = _thread!['seller'] as Map<String, dynamic>;
              await Supabase.instance.client.from('trades').insert({
                'listing_id': listing['id'],
                'thread_id': widget.threadId,
                'buyer_id': buyer['id'],
                'seller_id': seller['id'],
                'status': 'completed',
              });
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('¡Intercambio marcado como completado!'),
                    backgroundColor: KColors.success,
                  ),
                );
                // Redirect to profile to leave rating
                final otherId = _myUserId == buyer['id']
                    ? seller['id']
                    : buyer['id'];
                context.go('/home/profile/$otherId');
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: KColors.green,
              foregroundColor: Colors.black,
            ),
            child: const Text('Confirmar'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final buyer = _thread?['buyer'] as Map<String, dynamic>?;
    final seller = _thread?['seller'] as Map<String, dynamic>?;
    final other = _myUserId == buyer?['id'] ? seller : buyer;

    return Scaffold(
      appBar: AppBar(
        title: other != null
            ? Row(
                children: [
                  CircleAvatar(
                    radius: 18,
                    backgroundColor: KColors.surface2,
                    backgroundImage: other['avatar_url'] != null
                        ? CachedNetworkImageProvider(other['avatar_url'])
                        : null,
                    child: other['avatar_url'] == null
                        ? Text(
                            (other['name'] as String)
                                .substring(0, 1)
                                .toUpperCase(),
                            style: KTextStyles.label,
                          )
                        : null,
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(other['name'] ?? '', style: KTextStyles.label),
                      if (_thread?['listing'] != null)
                        Text(
                          _thread!['listing']['title'] ?? '',
                          style: KTextStyles.caption,
                          overflow: TextOverflow.ellipsis,
                        ),
                    ],
                  ),
                ],
              )
            : const Text('Chat'),
        actions: [
          IconButton(
            icon: const Icon(Icons.check_circle_outline, color: KColors.green),
            tooltip: 'Marcar completado',
            onPressed: _markTrade,
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scroll,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
              itemCount: _messages.length + 1, // +1 for the warning banner
              itemBuilder: (_, i) {
                if (i == 0) {
                  return Container(
                    margin: const EdgeInsets.only(bottom: 24, top: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: KColors.surface2,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: KColors.divider),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(
                          Icons.security_rounded,
                          color: KColors.textSecondary,
                          size: 20,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Nunca compartas tu clave, ni transfieras dinero sin verificar el producto en persona.',
                            style: KTextStyles.caption.copyWith(
                              color: KColors.textSecondary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }

                final m = _messages[i - 1]; // Shift index by 1
                final isMe = m['sender_id'] == _myUserId;
                return Align(
                  alignment: isMe
                      ? Alignment.centerRight
                      : Alignment.centerLeft,
                  child: Column(
                    crossAxisAlignment: isMe
                        ? CrossAxisAlignment.end
                        : CrossAxisAlignment.start,
                    children: [
                      Container(
                        constraints: BoxConstraints(
                          maxWidth: MediaQuery.of(context).size.width * 0.75,
                        ),
                        margin: const EdgeInsets.only(bottom: 2),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: isMe ? KColors.surface3 : KColors.surface2,
                          borderRadius: BorderRadius.only(
                            topLeft: const Radius.circular(18),
                            topRight: const Radius.circular(18),
                            bottomLeft: Radius.circular(isMe ? 18 : 4),
                            bottomRight: Radius.circular(isMe ? 4 : 18),
                          ),
                        ),
                        child: Text(
                          m['text'] ?? '',
                          style: TextStyle(
                            fontSize: 15,
                            color: isMe ? Colors.white : Colors.white,
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12, top: 2),
                        child: Text(
                          timeago.format(
                            DateTime.parse(m['created_at']),
                            locale: 'es',
                          ),
                          style: KTextStyles.caption.copyWith(
                            fontSize: 10,
                            color: KColors.textHint,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
          // Message input
          Container(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 16),
            decoration: const BoxDecoration(
              color: KColors.bg,
              border: Border(top: BorderSide(color: KColors.divider)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _msg,
                    style: KTextStyles.body,
                    decoration: InputDecoration(
                      hintText: 'Escribe un mensaje...',
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 10,
                      ),
                      fillColor: KColors.surface2,
                      filled: true,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: BorderSide.none,
                      ),
                    ),
                    onSubmitted: (_) => _send(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: _sending ? null : _send,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  icon: _sending
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: KColors.green,
                          ),
                        )
                      : const Icon(
                          Icons.send_rounded,
                          color: KColors.green,
                          size: 28,
                        ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
