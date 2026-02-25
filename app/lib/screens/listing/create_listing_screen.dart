import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'dart:typed_data';
import '../../core/constants.dart';
import '../../theme/app_theme.dart';
import '../../widgets/k_text_field.dart';
import '../../widgets/k_button.dart';

class CreateListingScreen extends StatefulWidget {
  final String? editId;
  const CreateListingScreen({super.key, this.editId});

  @override
  State<CreateListingScreen> createState() => _CreateListingScreenState();
}

class _CreateListingScreenState extends State<CreateListingScreen> {
  final _form = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _offerText = TextEditingController();
  final _wantText = TextEditingController();
  final _desc = TextEditingController();

  String _type = 'cambio';
  String? _category, _state;
  bool _loading = false;
  final List<XFile> _images = [];
  final Map<int, List<int>> _imageBytes =
      {}; // cached bytes for web-safe preview
  String? _myUserId;

  @override
  void initState() {
    super.initState();
    _getUser();
    if (widget.editId != null) _loadExisting();
  }

  Future<void> _getUser() async {
    final authUid = Supabase.instance.client.auth.currentUser?.id;
    if (authUid == null) return;
    final u = await Supabase.instance.client
        .from('users')
        .select('id')
        .eq('auth_id', authUid)
        .maybeSingle();
    _myUserId = u?['id'];
  }

  Future<void> _loadExisting() async {
    final data = await Supabase.instance.client
        .from('listings')
        .select('*')
        .eq('id', widget.editId!)
        .single();
    setState(() {
      _title.text = data['title'] ?? '';
      _offerText.text = data['offer_text'] ?? '';
      _wantText.text = data['want_text'] ?? '';
      _desc.text = data['description'] ?? '';
      _type = data['type'] ?? 'cambio';
      _category = data['category'];
      _state = data['state'];
    });
  }

  Future<void> _pickImages() async {
    final picker = ImagePicker();
    final picked = await picker.pickMultiImage(imageQuality: 80, limit: 5);
    final toAdd = picked.take(5 - _images.length).toList();
    // Pre-load bytes for web-safe preview
    for (int i = 0; i < toAdd.length; i++) {
      final bytes = await toAdd[i].readAsBytes();
      _imageBytes[_images.length + i] = bytes;
    }
    setState(() => _images.addAll(toAdd));
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    if (_myUserId == null) return;
    setState(() => _loading = true);

    try {
      final payload = {
        'user_id': _myUserId,
        'type': _type,
        'title': _title.text.trim(),
        'offer_text': _offerText.text.trim(),
        'want_text': _wantText.text.trim(),
        'description': _desc.text.trim().isEmpty ? null : _desc.text.trim(),
        'category': _category,
        'state': _state,
      };

      String listingId;
      if (widget.editId != null) {
        await Supabase.instance.client
            .from('listings')
            .update(payload)
            .eq('id', widget.editId!);
        listingId = widget.editId!;
      } else {
        final res = await Supabase.instance.client
            .from('listings')
            .insert(payload)
            .select()
            .single();
        listingId = res['id'] as String;
      }

      // Upload new photos
      for (int i = 0; i < _images.length; i++) {
        final bytes = await _images[i].readAsBytes();
        final path =
            'listings/$listingId/${DateTime.now().millisecondsSinceEpoch}_$i';
        await Supabase.instance.client.storage
            .from('kambio-photos')
            .uploadBinary(
              path,
              bytes,
              fileOptions: const FileOptions(upsert: true),
            );
        final url = Supabase.instance.client.storage
            .from('kambio-photos')
            .getPublicUrl(path);
        await Supabase.instance.client.from('listing_photos').insert({
          'listing_id': listingId,
          'url': url,
          'order': i,
        });
      }

      if (mounted) context.go('/home/listing/$listingId');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: KColors.error),
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
        title: Text(widget.editId != null ? 'Editar oferta' : 'Nueva oferta'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _form,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Type selector
              Text('Tipo de oferta', style: KTextStyles.label),
              const SizedBox(height: 10),
              Row(
                children: [
                  _typeChip('cambio', 'Cambio Bs↔\$'),
                  const SizedBox(width: 8),
                  _typeChip('trueque', 'Trueque'),
                  const SizedBox(width: 8),
                  _typeChip('servicio', 'Servicio'),
                ],
              ),
              const SizedBox(height: 20),

              KTextField(
                controller: _title,
                label: 'Título',
                hint: 'Ej: iPhone 12 por Zelle',
                validator: (v) => (v?.length ?? 0) >= 3 ? null : 'Requerido',
              ),
              const SizedBox(height: 16),

              KTextField(
                controller: _offerText,
                label: '¿Qué ofreces?',
                hint: 'Ej: 200 USD en Zelle',
                maxLines: 2,
                validator: (v) => (v?.isNotEmpty ?? false) ? null : 'Requerido',
              ),
              const SizedBox(height: 16),

              KTextField(
                controller: _wantText,
                label: '¿Qué quieres a cambio?',
                hint: 'Ej: Bolívares o artículos de limpieza',
                maxLines: 2,
                validator: (v) => (v?.isNotEmpty ?? false) ? null : 'Requerido',
              ),
              const SizedBox(height: 16),

              KTextField(
                controller: _desc,
                label: 'Descripción (opcional)',
                hint: 'Detalles adicionales...',
                maxLines: 3,
              ),
              const SizedBox(height: 16),

              // Category + State
              Text('Categoría', style: KTextStyles.label),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: _category,
                dropdownColor: KColors.surface2,
                style: KTextStyles.body,
                hint: Text(
                  'Seleccionar categoría',
                  style: KTextStyles.body.copyWith(color: KColors.textHint),
                ),
                items: AppConfig.categories
                    .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                    .toList(),
                onChanged: (v) => setState(() => _category = v),
              ),
              const SizedBox(height: 16),

              Text('Estado / Ciudad', style: KTextStyles.label),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: _state,
                dropdownColor: KColors.surface2,
                style: KTextStyles.body,
                hint: Text(
                  'Seleccionar estado',
                  style: KTextStyles.body.copyWith(color: KColors.textHint),
                ),
                items: AppConfig.states
                    .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                    .toList(),
                onChanged: (v) => setState(() => _state = v),
              ),
              const SizedBox(height: 20),

              // Photos
              Text('Fotos (máx. 5)', style: KTextStyles.label),
              const SizedBox(height: 10),
              SizedBox(
                height: 100,
                child: Row(
                  children: [
                    GestureDetector(
                      onTap: _pickImages,
                      child: Container(
                        width: 90,
                        height: 90,
                        decoration: BoxDecoration(
                          color: KColors.surface2,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: KColors.divider),
                        ),
                        child: const Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.add_photo_alternate_outlined,
                              color: KColors.textHint,
                              size: 28,
                            ),
                            SizedBox(height: 4),
                            Text(
                              'Agregar',
                              style: TextStyle(
                                fontSize: 10,
                                color: KColors.textHint,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _images.length,
                        separatorBuilder: (_, _) => const SizedBox(width: 8),
                        itemBuilder: (_, i) => Stack(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: _imageBytes.containsKey(i)
                                  ? Image.memory(
                                      Uint8List.fromList(_imageBytes[i]!),
                                      width: 88,
                                      height: 88,
                                      fit: BoxFit.cover,
                                    )
                                  : Container(
                                      width: 88,
                                      height: 88,
                                      color: KColors.surface2,
                                    ),
                            ),
                            Positioned(
                              top: 2,
                              right: 2,
                              child: GestureDetector(
                                onTap: () => setState(() {
                                  _images.removeAt(i);
                                  _imageBytes.remove(i);
                                  // re-index bytes above i
                                  for (int j = i; j < _images.length; j++) {
                                    _imageBytes[j] = _imageBytes[j + 1] ?? [];
                                  }
                                  _imageBytes.remove(_images.length);
                                }),
                                child: Container(
                                  decoration: const BoxDecoration(
                                    color: Colors.black54,
                                    shape: BoxShape.circle,
                                  ),
                                  padding: const EdgeInsets.all(2),
                                  child: const Icon(
                                    Icons.close,
                                    size: 14,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 28),
              KButton(
                label: widget.editId != null
                    ? 'Guardar cambios'
                    : 'Publicar oferta',
                loading: _loading,
                onPressed: _submit,
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _typeChip(String value, String label) {
    final selected = _type == value;
    final color = switch (value) {
      'cambio' => KColors.blue,
      'trueque' => KColors.green,
      _ => const Color(0xFFFF6E40),
    };
    return GestureDetector(
      onTap: () => setState(() => _type = value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? color.withValues(alpha: 0.15) : KColors.surface2,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: selected ? color : Colors.transparent),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: selected ? color : KColors.textSecondary,
          ),
        ),
      ),
    );
  }
}
