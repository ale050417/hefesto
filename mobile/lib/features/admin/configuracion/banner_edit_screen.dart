import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/frame_editor.dart';
import '../../../core/widgets/photo_picker.dart';
import '../admin_widgets.dart';
import 'config_api.dart';
import 'config_models.dart';
import 'config_widgets.dart';

/// Encuadres que se pueden elegir desde el teléfono: qué franja de la imagen
/// se ve cuando el banner la recorta (valor de `position`, como en la web).
const List<(String, String)> bannerFrames = [
  ('50% 0%', 'Arriba'),
  // "Medio" y no "Centro": ese rótulo ya lo usa la alineación del texto.
  ('50% 50%', 'Medio'),
  ('50% 100%', 'Abajo'),
];

/// Un banner del inicio: se elige o se cambia su imagen (pedido de Ale,
/// 2026-11-17: "quise cambiar los banners desde el celular pero no me deja"),
/// se edita su título, texto, botón y alineación, se muestra u oculta, o se
/// elimina. La imagen se acomoda arrastrándola en la vista previa. Sin [banner]
/// es el alta de uno nuevo (queda al final del carrusel; el orden se cambia
/// arrastrando en la lista de Tienda).
class BannerEditScreen extends ConsumerStatefulWidget {
  const BannerEditScreen({super.key, this.banner, required this.canEdit});

  /// Null = banner nuevo.
  final BannerInfo? banner;
  final bool canEdit;

  @override
  ConsumerState<BannerEditScreen> createState() => _BannerEditScreenState();
}

class _BannerEditScreenState extends ConfigFormState<BannerEditScreen> {
  late final _title = TextEditingController(text: widget.banner?.title ?? '');
  late final _subtitle = TextEditingController(text: widget.banner?.subtitle ?? '');
  late final _ctaText = TextEditingController(text: widget.banner?.ctaText ?? '');
  late final _ctaHref = TextEditingController(text: widget.banner?.ctaHref ?? '');
  late String _align = widget.banner?.align ?? 'left';
  late bool _active = widget.banner?.isActive ?? true;
  late String _position = widget.banner?.position ?? '50% 50%';
  String? _titleError;
  bool _deleting = false;

  /// Imagen elegida en el teléfono y todavía sin guardar (null = la que ya tiene).
  PickedPhoto? _picked;

  /// Lo último que se subió: si el guardado falla después de subir (o se
  /// guarda dos veces), la misma foto no se sube de nuevo.
  PickedPhoto? _uploaded;
  String? _uploadedUrl;

  /// La imagen que ya quedó guardada en el banner desde esta pantalla.
  PickedPhoto? _savedPhoto;
  bool _picking = false;
  String? _imageNotice;

  bool get _isNew => widget.banner == null;
  bool get _hasImage => _picked != null || (widget.banner?.imageUrl ?? '').isNotEmpty;

  @override
  void initState() {
    super.initState();
    markClean();
  }

  @override
  void dispose() {
    for (final c in [_title, _subtitle, _ctaText, _ctaHref]) {
      c.dispose();
    }
    super.dispose();
  }

  Map<String, dynamic> _body() => {
        'title': _title.text.trim(),
        'subtitle': _subtitle.text.trim(),
        'ctaText': _ctaText.text.trim(),
        'ctaHref': _ctaHref.text.trim(),
        'align': _align,
        'isActive': _active,
      };

  /// Además de los textos, la imagen elegida y el encuadre (para saber si hay
  /// cambios sin guardar).
  @override
  Object? snapshot() => {
        ..._body(),
        'position': _position,
        'image': _picked == null || identical(_picked, _savedPhoto) ? null : '${_picked!.filename}:${_picked!.bytes.length}',
      };

  Future<void> _pickImage() async {
    if (_picking || saving) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _picking = true;
      _imageNotice = null;
    });
    final res = await pickOnePhoto(context, ref, title: _hasImage ? 'Cambiar imagen' : 'Elegir imagen');
    if (!mounted) return;
    setState(() {
      _picking = false;
      _imageNotice = res.error;
      if (res.photo != null) {
        _picked = res.photo;
        error = null;
      }
    });
  }

  /// Sube la imagen elegida (si hay una nueva) y devuelve su dirección.
  Future<String?> _uploadIfNeeded() async {
    final photo = _picked;
    if (photo == null || identical(photo, _savedPhoto)) return null;
    if (identical(photo, _uploaded) && _uploadedUrl != null) return _uploadedUrl;
    final url = await ref.read(configApiProvider).uploadImage(photo, 'banner');
    _uploaded = photo;
    _uploadedUrl = url;
    return url;
  }

  Future<void> _onSave() async {
    FocusScope.of(context).unfocus();
    if (_title.text.trim().isEmpty) {
      setState(() {
        _titleError = 'Ingresá un título.';
        error = 'Revisá los campos marcados.';
      });
      return;
    }
    setState(() => _titleError = null);
    final photo = _picked;
    final ok = await save(
      () async {
        final api = ref.read(configApiProvider);
        final url = await _uploadIfNeeded();
        final banner = widget.banner;
        if (banner == null) {
          await api.createBanner({..._body(), 'imageUrl': ?url, 'position': _position});
        } else {
          await api.updateBanner(banner.id, {
            ..._body(),
            'imageUrl': ?url,
            if (_position != banner.position) 'position': _position,
          });
        }
        _savedPhoto = photo;
        // La vidriera de la app muestra los mismos banners.
        ref.invalidate(homeProvider);
      },
      _isNew ? 'Banner creado' : 'Banner actualizado',
    );
    // El nuevo ya está en la lista de Tienda: se vuelve ahí.
    if (ok && _isNew && mounted) Navigator.of(context).pop();
  }

  Future<void> _delete() async {
    final banner = widget.banner;
    if (banner == null) return;
    final ok = await confirmAction(
      context,
      title: 'Eliminar banner',
      message: '"${banner.title}" deja de mostrarse en la tienda. No se puede deshacer.',
      confirmLabel: 'Eliminar',
      destructive: true,
    );
    if (!ok || !mounted) return;
    setState(() {
      _deleting = true;
      error = null;
    });
    try {
      await ref.read(configApiProvider).deleteBanner(banner.id);
      if (!mounted) return;
      ref.invalidate(adminConfigProvider);
      ref.invalidate(homeProvider);
      markClean(); // ya no hay nada que perder: deja salir sin preguntar
      showOk(context, 'Banner eliminado');
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _deleting = false;
        error = apiErrorText(e);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final enabled = widget.canEdit && !_deleting;
    final picked = _picked;
    return ConfigSectionScaffold(
      title: _isNew ? 'Nuevo banner' : 'Banner',
      saveLabel: _isNew ? 'Crear banner' : 'Guardar cambios',
      dirty: dirty,
      saving: saving || _deleting,
      canEdit: widget.canEdit,
      error: error,
      onSave: _onSave,
      onChanged: touch,
      children: [
        // Vista previa con la forma del banner. Con permiso se arrastra para
        // elegir qué parte de la imagen se ve (pedido de Ale, 2026-11-18): la
        // foto recién elegida o la que ya tiene, con el recorte que va a tener.
        if (_hasImage)
          FramingBox(
            bytes: picked?.bytes,
            url: picked == null ? widget.banner?.imageUrl : null,
            aspectRatio: 16 / 6,
            position: _position,
            onChanged: enabled
                ? (p) => setState(() {
                      error = null;
                      _position = p;
                    })
                : null,
          )
        else
          AspectRatio(
            aspectRatio: 16 / 6,
            child: Container(
              decoration: BoxDecoration(
                color: c.surface2,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: c.border),
              ),
              alignment: Alignment.center,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.image_outlined, size: 30, color: c.textFaint),
                  const SizedBox(height: 4),
                  Text('Sin imagen', style: TextStyle(fontSize: 12.5, color: c.textDim)),
                ],
              ),
            ),
          ),
        const SizedBox(height: 8),
        if (widget.canEdit) ...[
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton.icon(
              onPressed: enabled && !_picking && !saving ? _pickImage : null,
              icon: const Icon(Icons.photo_library_outlined, size: 18),
              label: Text(_hasImage ? 'Cambiar imagen' : 'Elegir imagen'),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            picked != null
                ? 'Imagen nueva: se sube al guardar.'
                : 'Mejor apaisada (1920 × 720). JPG, PNG o WebP, hasta 4 MB.',
            style: TextStyle(fontSize: 12, color: c.textFaint, height: 1.35),
          ),
          if (_imageNotice != null) ...[
            const SizedBox(height: 6),
            Text(_imageNotice!, style: const TextStyle(fontSize: 12.5, color: Brand.warning, height: 1.3)),
          ],
        ],
        if (_hasImage) ...[
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.only(left: 2, bottom: 6),
            child: Text('Encuadre de la imagen',
                style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: c.textDim)),
          ),
          SizedBox(
            width: double.infinity,
            child: SegmentedButton<String>(
              segments: [
                for (final (value, label) in bannerFrames)
                  ButtonSegment(
                    value: value,
                    label: FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(label, maxLines: 1, softWrap: false),
                    ),
                  ),
              ],
              // Atajos. Un encuadre fino (hecho arrastrando, o en la web) no
              // coincide con ninguno de los tres: no se marca ninguno.
              selected: {if (bannerFrames.any((f) => f.$1 == _position)) _position},
              emptySelectionAllowed: true,
              showSelectedIcon: false,
              onSelectionChanged: enabled
                  ? (s) {
                      if (s.isEmpty) return;
                      setState(() {
                        error = null;
                        _position = s.first;
                      });
                    }
                  : null,
            ),
          ),
        ],
        const SizedBox(height: 14),
        AdminCard(
          child: ConfigSwitchRow(
            title: 'Mostrar en la tienda',
            subtitle: _active ? 'Aparece en el carrusel del inicio.' : 'Oculto: no se muestra a los clientes.',
            value: _active,
            onChanged: enabled
                ? (v) => setState(() {
                      error = null;
                      _active = v;
                    })
                : null,
          ),
        ),
        const AdminSectionTitle('Textos'),
        ConfigField(
          controller: _title,
          label: 'Título',
          errorText: _titleError,
          maxLength: 120,
          enabled: enabled,
          textCapitalization: TextCapitalization.sentences,
        ),
        ConfigField(
          controller: _subtitle,
          label: 'Subtítulo',
          maxLines: 3,
          maxLength: 200,
          enabled: enabled,
          textCapitalization: TextCapitalization.sentences,
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(left: 2, bottom: 6),
                child: Text('Alineación del texto',
                    style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: c.textDim)),
              ),
              // Sin íconos y a todo el ancho (2026-11-14, pedido de Ale): con el
              // ícono al lado, en un teléfono de 360 dp "Izquierda" se partía
              // en dos líneas ("Izquier/da"). Cada rótulo va en UNA línea y, si
              // con letra grande no entra, se achica en vez de partirse.
              SizedBox(
                width: double.infinity,
                child: SegmentedButton<String>(
                  segments: [
                    for (final (value, label) in const [
                      ('left', 'Izquierda'),
                      ('center', 'Centro'),
                      ('right', 'Derecha'),
                    ])
                      ButtonSegment(
                        value: value,
                        label: FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(label, maxLines: 1, softWrap: false),
                        ),
                      ),
                  ],
                  selected: {_align},
                  showSelectedIcon: false,
                  onSelectionChanged: enabled
                      ? (s) => setState(() {
                            error = null;
                            _align = s.first;
                          })
                      : null,
                ),
              ),
            ],
          ),
        ),
        const AdminSectionTitle('Botón'),
        ConfigField(
          controller: _ctaText,
          label: 'Texto del botón',
          hint: 'Ver productos',
          maxLength: 60,
          enabled: enabled,
        ),
        ConfigField(
          controller: _ctaHref,
          label: 'A dónde lleva',
          hint: '/productos',
          maxLength: 200,
          keyboardType: TextInputType.url,
          enabled: enabled,
        ),
        if (widget.canEdit && !_isNew) ...[
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _deleting || saving ? null : _delete,
            icon: const Icon(Icons.delete_outline_rounded, color: Brand.danger),
            label: const Text('Eliminar banner', style: TextStyle(color: Brand.danger)),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              side: BorderSide(color: Brand.danger.withValues(alpha: 0.5)),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
          ),
        ],
      ],
    );
  }
}
