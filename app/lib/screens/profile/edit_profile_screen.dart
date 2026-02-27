import 'package:flutter/foundation.dart'; // Add kIsWeb import
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../theme/app_theme.dart';
import '../../widgets/k_button.dart';

class EditProfileScreen extends StatefulWidget {
  final Map<String, dynamic> user;
  const EditProfileScreen({super.key, required this.user});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameCtrl;
  late final TextEditingController _bioCtrl;
  XFile? _pickedImage;
  Uint8List? _pickedImageBytes;
  bool _uploading = false;
  String? _avatarUrl;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.user['name'] ?? '');
    _bioCtrl = TextEditingController(text: widget.user['bio'] ?? '');
    _avatarUrl = widget.user['avatar_url'] as String?;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _bioCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 80,
      maxWidth: 600,
    );
    if (picked != null) {
      final bytes = await picked.readAsBytes();
      setState(() {
        _pickedImage = picked;
        _pickedImageBytes = bytes;
      });
    }
  }

  Future<String?> _uploadAvatar(String userId) async {
    if (_pickedImage == null || _pickedImageBytes == null) return _avatarUrl;
    final ext = _pickedImage!.path.split('.').last.toLowerCase();

    // For web compatibility, default to png if extension is empty or a blob URL
    final safeExt = (ext.isEmpty || ext.contains('blob') || ext.contains('/'))
        ? 'png'
        : ext;
    final path = 'avatars/$userId.$safeExt';

    final res = await Supabase.instance.client.storage
        .from('avatars')
        .uploadBinary(
          path,
          _pickedImageBytes!,
          fileOptions: FileOptions(upsert: true, contentType: 'image/$safeExt'),
        );
    if (res.isEmpty) return null;

    return Supabase.instance.client.storage.from('avatars').getPublicUrl(path);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _uploading = true);

    try {
      final userId = widget.user['id'] as String;
      final newAvatarUrl = await _uploadAvatar(userId);

      await Supabase.instance.client
          .from('users')
          .update({
            'name': _nameCtrl.text.trim(),
            'bio': _bioCtrl.text.trim(),
            if (newAvatarUrl != null) 'avatar_url': newAvatarUrl,
          })
          .eq('id', userId);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Perfil actualizado'),
            backgroundColor: KColors.green,
          ),
        );
        Navigator.pop(context, true); // signal refresh
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: KColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ImageProvider? displayImage;
    if (_pickedImageBytes != null) {
      displayImage = MemoryImage(_pickedImageBytes!);
    } else if (_avatarUrl != null) {
      displayImage = NetworkImage(_avatarUrl!);
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Editar perfil'),
        backgroundColor: KColors.bg,
        foregroundColor: KColors.textPrimary,
        elevation: 0,
      ),
      backgroundColor: KColors.bg,
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              // Avatar picker
              GestureDetector(
                onTap: _uploading ? null : _pickImage,
                child: Stack(
                  alignment: Alignment.bottomRight,
                  children: [
                    CircleAvatar(
                      radius: 56,
                      backgroundColor: KColors.surface2,
                      backgroundImage: displayImage,
                      child: displayImage == null
                          ? Text(
                              (_nameCtrl.text.isNotEmpty ? _nameCtrl.text : 'U')
                                  .substring(0, 1)
                                  .toUpperCase(),
                              style: KTextStyles.h1,
                            )
                          : null,
                    ),
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: KColors.green,
                        shape: BoxShape.circle,
                        border: Border.all(color: KColors.bg, width: 2),
                      ),
                      child: const Icon(
                        Icons.camera_alt,
                        size: 16,
                        color: Colors.black,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              Text('Toca la foto para cambiarla', style: KTextStyles.bodySmall),
              const SizedBox(height: 32),

              // Name field
              _field(
                controller: _nameCtrl,
                label: 'Nombre',
                icon: Icons.person_outline,
                validator: (v) => (v == null || v.trim().isEmpty)
                    ? 'El nombre no puede estar vacío'
                    : null,
              ),
              const SizedBox(height: 16),

              // Bio field
              _field(
                controller: _bioCtrl,
                label: 'Sobre mí',
                icon: Icons.edit_note,
                maxLines: 3,
              ),
              const SizedBox(height: 32),

              KButton(
                label: _uploading ? 'Guardando...' : 'Guardar cambios',
                onPressed: _uploading ? null : _save,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    int maxLines = 1,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      maxLines: maxLines,
      validator: validator,
      style: KTextStyles.body,
      decoration: InputDecoration(
        labelText: label,
        labelStyle: KTextStyles.bodySmall,
        prefixIcon: Icon(icon, color: KColors.textSecondary, size: 20),
        filled: true,
        fillColor: KColors.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: KColors.divider),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: KColors.divider),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: KColors.green),
        ),
      ),
    );
  }
}
