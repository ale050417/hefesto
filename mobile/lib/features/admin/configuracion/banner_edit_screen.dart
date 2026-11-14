import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../admin_widgets.dart';
import 'config_api.dart';
import 'config_models.dart';
import 'config_widgets.dart';

/// Un banner del inicio: se ve cómo quedó la imagen y se edita su título,
/// texto, botón y alineación, se muestra u oculta, o se elimina. La imagen en
/// sí se cambia desde la web.
class BannerEditScreen extends ConsumerStatefulWidget {
  const BannerEditScreen({super.key, required this.banner, required this.canEdit});
  final BannerInfo banner;
  final bool canEdit;

  @override
  ConsumerState<BannerEditScreen> createState() => _BannerEditScreenState();
}

class _BannerEditScreenState extends ConfigFormState<BannerEditScreen> {
  late final _title = TextEditingController(text: widget.banner.title);
  late final _subtitle = TextEditingController(text: widget.banner.subtitle ?? '');
  late final _ctaText = TextEditingController(text: widget.banner.ctaText ?? '');
  late final _ctaHref = TextEditingController(text: widget.banner.ctaHref ?? '');
  late String _align = widget.banner.align;
  late bool _active = widget.banner.isActive;
  String? _titleError;
  bool _deleting = false;

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

  @override
  Object? snapshot() => _body();

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
    await save(
      () => ref.read(configApiProvider).updateBanner(widget.banner.id, _body()),
      'Banner actualizado',
    );
  }

  Future<void> _delete() async {
    final ok = await confirmAction(
      context,
      title: 'Eliminar banner',
      message: '"${widget.banner.title}" deja de mostrarse en la tienda. No se puede deshacer.',
      confirmLabel: 'Eliminar',
      destructive: true,
    );
    if (!ok || !mounted) return;
    setState(() {
      _deleting = true;
      error = null;
    });
    try {
      await ref.read(configApiProvider).deleteBanner(widget.banner.id);
      if (!mounted) return;
      ref.invalidate(adminConfigProvider);
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
    return ConfigSectionScaffold(
      title: 'Banner',
      dirty: dirty,
      saving: saving || _deleting,
      canEdit: widget.canEdit,
      error: error,
      onSave: _onSave,
      onChanged: touch,
      children: [
        AspectRatio(
          aspectRatio: 16 / 6,
          child: NetImage(widget.banner.imageUrl, position: widget.banner.position, radius: 16),
        ),
        const SizedBox(height: 6),
        Text(
          'La imagen se cambia desde la web.',
          style: TextStyle(fontSize: 12, color: c.textFaint),
        ),
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
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'left', label: Text('Izquierda'), icon: Icon(Icons.format_align_left_rounded)),
                  ButtonSegment(value: 'center', label: Text('Centro'), icon: Icon(Icons.format_align_center_rounded)),
                  ButtonSegment(value: 'right', label: Text('Derecha'), icon: Icon(Icons.format_align_right_rounded)),
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
        if (widget.canEdit) ...[
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
