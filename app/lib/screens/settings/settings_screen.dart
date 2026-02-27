import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../theme/app_theme.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Configuración')),
      body: ListView(
        children: [
          const SizedBox(height: 8),
          _tile(
            icon: Icons.person_outline,
            title: 'Mi perfil',
            onTap: () async {
              final authUid = Supabase.instance.client.auth.currentUser?.id;
              if (authUid == null) return;
              final u = await Supabase.instance.client
                  .from('users')
                  .select('id')
                  .eq('auth_id', authUid)
                  .maybeSingle();
              final profileId = u?['id'] as String?;
              if (profileId != null && context.mounted) {
                context.go('/home/profile/$profileId');
              }
            },
          ),
          _tile(
            icon: Icons.info_outline,
            title: 'Sobre Kambio',
            onTap: () => showAboutDialog(
              context: context,
              applicationName: 'Kambio',
              applicationVersion: '1.0.0',
              applicationLegalese:
                  '© 2025 Kambio. Todos los derechos reservados.',
            ),
          ),
          _tile(
            icon: Icons.shield_outlined,
            title: 'Política de privacidad',
            onTap: () {
              ScaffoldMessenger.of(
                context,
              ).showSnackBar(const SnackBar(content: Text('Próximamente')));
            },
          ),
          _tile(
            icon: Icons.gavel_outlined,
            title: 'Términos de uso',
            onTap: () {
              ScaffoldMessenger.of(
                context,
              ).showSnackBar(const SnackBar(content: Text('Próximamente')));
            },
          ),
          const Divider(color: KColors.divider),
          _tile(
            icon: Icons.logout,
            title: 'Cerrar sesión',
            color: KColors.error,
            onTap: () async {
              await Supabase.instance.client.auth.signOut();
              if (context.mounted) context.go('/login');
            },
          ),
        ],
      ),
    );
  }

  Widget _tile({
    required IconData icon,
    required String title,
    required VoidCallback onTap,
    Color? color,
  }) {
    return ListTile(
      leading: Icon(icon, color: color ?? KColors.textSecondary),
      title: Text(
        title,
        style: KTextStyles.body.copyWith(color: color ?? KColors.textPrimary),
      ),
      trailing: const Icon(Icons.chevron_right, color: KColors.textHint),
      onTap: onTap,
    );
  }
}
