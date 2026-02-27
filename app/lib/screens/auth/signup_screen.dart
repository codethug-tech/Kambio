import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/constants.dart';
import '../../theme/app_theme.dart';
import '../../widgets/k_text_field.dart';
import '../../widgets/k_button.dart';

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _pass = TextEditingController();
  String? _city;
  String? _state;
  bool _loading = false;
  bool _obscure = true;

  Future<void> _signup() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      final auth = await Supabase.instance.client.auth.signUp(
        email: _email.text.trim(),
        password: _pass.text,
        data: {'name': _name.text.trim()}, // picked up by DB trigger
      );
      if (auth.user != null) {
        // Trigger already created public.users row — update with extra fields
        await Supabase.instance.client
            .from('users')
            .update({
              'name': _name.text.trim(),
              'phone': _phone.text.trim().isEmpty ? null : _phone.text.trim(),
              'city': _city,
              'state': _state,
            })
            .eq('auth_id', auth.user!.id);
        if (mounted) context.go('/onboarding');
      }
    } on AuthException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: KColors.error),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: KColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.go('/login')),
        title: const Text('Crear cuenta'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Form(
            key: _form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Únete a Kambio', style: KTextStyles.h2),
                const SizedBox(height: 4),
                Text(
                  'Crea tu perfil y empieza a intercambiar',
                  style: KTextStyles.body.copyWith(
                    color: KColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 28),

                KTextField(
                  controller: _name,
                  label: 'Nombre completo',
                  hint: 'Carlos González',
                  validator: (v) =>
                      (v?.length ?? 0) >= 2 ? null : 'Nombre requerido',
                ),
                const SizedBox(height: 16),
                KTextField(
                  controller: _email,
                  label: 'Correo electrónico',
                  hint: 'tu@correo.com',
                  keyboardType: TextInputType.emailAddress,
                  validator: (v) =>
                      v != null && v.contains('@') ? null : 'Correo inválido',
                ),
                const SizedBox(height: 16),
                KTextField(
                  controller: _phone,
                  label: 'Teléfono (opcional)',
                  hint: '+58 412 000 0000',
                  keyboardType: TextInputType.phone,
                ),
                const SizedBox(height: 16),

                // State dropdown
                Text('Estado', style: KTextStyles.label),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: _state,
                  dropdownColor: KColors.surface2,
                  style: KTextStyles.body,
                  decoration: InputDecoration(
                    hintText: 'Selecciona tu estado',
                    hintStyle: KTextStyles.body.copyWith(
                      color: KColors.textHint,
                    ),
                  ),
                  items: AppConfig.states
                      .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                      .toList(),
                  onChanged: (v) => setState(() => _state = v),
                ),
                const SizedBox(height: 16),

                KTextField(
                  controller: _pass,
                  label: 'Contraseña',
                  hint: '••••••••',
                  obscureText: _obscure,
                  validator: (v) =>
                      (v?.length ?? 0) >= 6 ? null : 'Mínimo 6 caracteres',
                  suffix: IconButton(
                    icon: Icon(
                      _obscure ? Icons.visibility_off : Icons.visibility,
                      color: KColors.textSecondary,
                      size: 20,
                    ),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                ),
                const SizedBox(height: 28),
                KButton(
                  label: 'Crear cuenta',
                  loading: _loading,
                  onPressed: _signup,
                ),
                const SizedBox(height: 16),
                Center(
                  child: TextButton(
                    onPressed: () => context.go('/login'),
                    child: const Text('Ya tengo una cuenta'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
