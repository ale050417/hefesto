import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/photo_picker.dart';
import '../admin_widgets.dart';
import 'banner_edit_screen.dart';
import 'config_api.dart';
import 'config_models.dart';
import 'config_widgets.dart';

/// Colores de acento sugeridos (los mismos que la web).
const List<String> accentChoices = [
  '#C9A84C',
  '#D4AF37',
  '#5A9CD9',
  '#9B7BD4',
  '#4CB782',
  '#D96A5A',
  '#E0A82E',
  '#2E8B57',
  '#7B4DB3',
];

const List<(String, int)> _intensities = [('Sutil', 9), ('Media', 16), ('Festiva', 26)];
const List<(String, int)> _durations = [('Siempre', 0), ('5 s', 5), ('10 s', 10), ('20 s', 20)];

final RegExp _hexRe = RegExp(r'^#[0-9a-fA-F]{6}$');

/// Tienda y apariencia: modo (vidriera), color de acento, temporada, secciones
/// del home, segundos entre banners, y las imágenes de la tienda: el logo, los
/// banners (se crean, se les cambia la imagen y los textos) y la imagen de
/// portada. Las imágenes se suben desde el teléfono (pedido de Ale,
/// 2026-11-17) y quedan puestas apenas suben: no esperan al "Guardar" de la
/// apariencia.
class TiendaScreen extends ConsumerStatefulWidget {
  const TiendaScreen({super.key, required this.initial, required this.canEdit});
  final TiendaConfig initial;
  final bool canEdit;

  @override
  ConsumerState<TiendaScreen> createState() => _TiendaScreenState();
}

class _TiendaScreenState extends ConfigFormState<TiendaScreen> {
  late bool _vidriera = widget.initial.isVidriera;
  late final _accent = TextEditingController(text: (widget.initial.accentColor ?? accentChoices.first).toUpperCase());
  late String _season = widget.initial.season;
  late bool _deco = widget.initial.seasonDeco;
  late int _intensity = widget.initial.seasonIntensity;
  late int _duration = widget.initial.seasonDurationSec;
  late int _interval = widget.initial.bannerIntervalSec.clamp(3, 12);
  late final Map<String, bool> _sections = {for (final s in widget.initial.homeSections) s.id: s.on};
  String? _accentError;

  /// Imagen que se está subiendo: `logo` o `hero` (null = ninguna).
  String? _uploading;

  /// Aviso por imagen (formato, peso, permiso negado, rechazo del servidor).
  final Map<String, String> _imageNotice = {};

  /// Cambia el logo o la imagen de portada: se elige, se sube y queda puesta.
  Future<void> _changeImage(String kind) async {
    if (_uploading != null) return;
    final isLogo = kind == 'logo';
    final res = await pickOnePhoto(context, ref, title: isLogo ? 'Cambiar logo' : 'Cambiar imagen de portada');
    if (!mounted) return;
    if (res.photo == null) {
      setState(() {
        if (res.error == null) {
          _imageNotice.remove(kind);
        } else {
          _imageNotice[kind] = res.error!;
        }
      });
      return;
    }
    setState(() {
      _uploading = kind;
      _imageNotice.remove(kind);
    });
    try {
      await ref.read(configApiProvider).uploadImage(res.photo!, kind);
      if (!mounted) return;
      ref.invalidate(adminConfigProvider);
      // El logo y la portada también se ven en la vidriera de la app.
      ref.invalidate(homeProvider);
      showOk(context, isLogo ? 'Logo actualizado' : 'Imagen de portada actualizada');
    } catch (e) {
      if (mounted) setState(() => _imageNotice[kind] = apiErrorText(e));
    } finally {
      if (mounted) setState(() => _uploading = null);
    }
  }

  @override
  void initState() {
    super.initState();
    markClean();
  }

  @override
  void dispose() {
    _accent.dispose();
    super.dispose();
  }

  Map<String, dynamic> _body() => {
        'businessMode': _vidriera ? 'vidriera' : 'checkout',
        'accentColor': _accent.text.trim().toUpperCase(),
        'season': _season,
        'seasonDeco': _deco,
        'seasonIntensity': _intensity,
        'seasonDurationSec': _duration,
        'homeSections': _sections,
        'bannerIntervalSec': _interval,
      };

  @override
  Object? snapshot() => _body();

  SeasonOption? get _seasonOpt => widget.initial.seasons.where((s) => s.key == _season).firstOrNull;

  void _set(void Function() change) => setState(() {
        error = null;
        change();
      });

  Future<void> _onSave() async {
    FocusScope.of(context).unfocus();
    final hex = _accent.text.trim();
    if (!_hexRe.hasMatch(hex)) {
      setState(() {
        _accentError = 'Usá el formato #RRGGBB (ej. #C9A84C).';
        error = 'Revisá los campos marcados.';
      });
      return;
    }
    setState(() => _accentError = null);
    await save(() => ref.read(configApiProvider).saveTienda(_body()), 'Apariencia guardada y publicada');
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final enabled = widget.canEdit;
    final seasonActive = _season != 'none';
    // Los banners y las imágenes se cambian aparte del formulario: acá se
    // muestra siempre lo último que hay en el servidor.
    final live = ref.watch(adminConfigProvider).value?.tienda ?? widget.initial;
    final banners = live.banners;
    final currentAccent = _accent.text.trim().toUpperCase();

    return ConfigSectionScaffold(
      title: 'Tienda y apariencia',
      dirty: dirty,
      saving: saving,
      canEdit: widget.canEdit,
      error: error,
      onSave: _onSave,
      onChanged: touch,
      children: [
        AdminCard(
          child: Row(
            children: [
              Container(
                width: 64,
                height: 64,
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: c.surface2,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: c.border),
                ),
                child: BrandLogo(url: live.logoUrl, size: 52),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Logo', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                    const SizedBox(height: 2),
                    Text(
                      'Se ve en la tienda, en la app y en los comprobantes. Mejor cuadrado y con fondo transparente.',
                      style: TextStyle(fontSize: 12, color: c.textDim, height: 1.35),
                    ),
                    if (enabled) ...[
                      const SizedBox(height: 8),
                      _UploadButton(
                        label: 'Cambiar logo',
                        busy: _uploading == 'logo',
                        onPressed: _uploading == null ? () => _changeImage('logo') : null,
                      ),
                    ],
                    if (_imageNotice['logo'] != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        _imageNotice['logo']!,
                        style: const TextStyle(fontSize: 12.5, color: Brand.warning, height: 1.3),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
        const AdminSectionTitle('Modo de negocio'),
        AdminCard(
          child: ConfigSwitchRow(
            title: 'Vidriera digital',
            subtitle: _vidriera
                ? 'Sin carrito ni pago online: cada producto manda a WhatsApp. Se esconden el login y "Mis pedidos".'
                : 'Apagado: la tienda vende online con carrito y pago.',
            value: _vidriera,
            onChanged: enabled ? (v) => _set(() => _vidriera = v) : null,
          ),
        ),
        const AdminSectionTitle('Color de acento'),
        AdminCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (seasonActive)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Text(
                    'La temporada activa define los colores de la tienda; este acento se usa cuando no hay temporada.',
                    style: TextStyle(fontSize: 12, color: c.textDim, height: 1.35),
                  ),
                ),
              // Cada muestra ocupa 48 dp para tocar (la muestra en sí mide 40):
              // el corrimiento compensa ese margen y la deja alineada al texto.
              Transform.translate(
                offset: const Offset(-4, 0),
                child: Wrap(
                  spacing: 2,
                  runSpacing: 2,
                  children: [
                    for (final hex in accentChoices)
                      _Swatch(
                        color: parseHex(hex),
                        selected: currentAccent == hex.toUpperCase(),
                        dim: seasonActive,
                        label: 'Color $hex',
                        onTap: enabled ? () => _set(() => _accent.text = hex) : null,
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              ConfigField(
                controller: _accent,
                label: 'Otro color (hex)',
                hint: '#C9A84C',
                errorText: _accentError,
                maxLength: 7,
                enabled: enabled,
                textCapitalization: TextCapitalization.characters,
              ),
            ],
          ),
        ),
        const AdminSectionTitle('Temporada o campaña'),
        const ConfigHint('Vestí la tienda para cada fecha: cambia el color y suma una decoración animada.'),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final s in widget.initial.seasons)
              _SeasonChip(
                option: s,
                selected: _season == s.key,
                onTap: enabled ? () => _set(() => _season = s.key) : null,
              ),
          ],
        ),
        if (_seasonOpt != null && _seasonOpt!.hint.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(_seasonOpt!.hint, style: TextStyle(fontSize: 12, color: c.textFaint)),
          ),
        if (_seasonOpt?.hasDeco ?? false) ...[
          const SizedBox(height: 12),
          AdminCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ConfigSwitchRow(
                  title: 'Decoración animada',
                  subtitle: 'Copos, hojas, corazones cayendo según la temporada.',
                  value: _deco,
                  onChanged: enabled ? (v) => _set(() => _deco = v) : null,
                ),
                if (_deco) ...[
                  const SizedBox(height: 10),
                  Text('Intensidad', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: c.textDim)),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    children: [
                      for (final (label, v) in _intensities)
                        ChoiceChip(
                          label: Text(label),
                          selected: _intensity == v,
                          onSelected: enabled ? (_) => _set(() => _intensity = v) : null,
                        ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text('Duración al entrar', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: c.textDim)),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    children: [
                      for (final (label, v) in _durations)
                        ChoiceChip(
                          label: Text(label),
                          selected: _duration == v,
                          onSelected: enabled ? (_) => _set(() => _duration = v) : null,
                        ),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      'Después de ese tiempo la decoración frena sola (mejor rendimiento).',
                      style: TextStyle(fontSize: 11.5, color: c.textFaint),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
        const AdminSectionTitle('Secciones del inicio'),
        const ConfigHint('Prendé o apagá lo que se muestra en la página principal de la tienda.'),
        AdminCard(
          padding: const EdgeInsets.fromLTRB(14, 6, 14, 6),
          child: Column(
            children: [
              for (final s in widget.initial.homeSections)
                ConfigSwitchRow(
                  title: s.label,
                  value: _sections[s.id] ?? true,
                  onChanged: enabled ? (v) => _set(() => _sections[s.id] = v) : null,
                ),
            ],
          ),
        ),
        const AdminSectionTitle('Banners del inicio'),
        AdminCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Segundos entre banners', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: c.textDim)),
              Row(
                children: [
                  Expanded(
                    child: Slider(
                      value: _interval.toDouble(),
                      min: 3,
                      max: 12,
                      divisions: 9,
                      label: '$_interval s',
                      // Sin color a mano: manda el tema (`sliderTheme`).
                      onChanged: enabled ? (v) => _set(() => _interval = v.round()) : null,
                    ),
                  ),
                  SizedBox(
                    width: 46,
                    child: Text(
                      '$_interval s',
                      textAlign: TextAlign.end,
                      style: const TextStyle(fontFamily: 'Orbitron', fontWeight: FontWeight.w700, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        if (banners.isEmpty)
          AdminCard(
            padding: const EdgeInsets.all(16),
            child: Text(
              enabled
                  ? 'Todavía no hay banners. Tocá "Nuevo banner" para cargar el primero.'
                  : 'Todavía no hay banners.',
              style: TextStyle(color: c.textDim, fontSize: 13.5),
            ),
          )
        else
          for (final b in banners)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _BannerTile(
                banner: b,
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => BannerEditScreen(banner: b, canEdit: enabled)),
                ),
              ),
            ),
        if (enabled) ...[
          const SizedBox(height: 2),
          OutlinedButton.icon(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const BannerEditScreen(canEdit: true)),
            ),
            icon: const Icon(Icons.add_photo_alternate_outlined, size: 18),
            label: const Text('Nuevo banner'),
          ),
          const SizedBox(height: 4),
          Text(
            'El nuevo queda al final. El orden de los banners se cambia desde la web.',
            style: TextStyle(fontSize: 11.5, color: c.textFaint),
          ),
        ],
        const AdminSectionTitle('Imagen de portada'),
        AdminCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AspectRatio(
                aspectRatio: 16 / 6,
                child: (live.heroImageUrl ?? '').isEmpty
                    ? Container(
                        decoration: BoxDecoration(
                          color: c.surface2,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: c.border),
                        ),
                        alignment: Alignment.center,
                        child: Text('Sin imagen de portada', style: TextStyle(fontSize: 12.5, color: c.textDim)),
                      )
                    : NetImage(live.heroImageUrl, radius: 14),
              ),
              const SizedBox(height: 8),
              Text(
                'Se muestra en el inicio de la tienda cuando no hay ningún banner visible.',
                style: TextStyle(fontSize: 12, color: c.textDim, height: 1.35),
              ),
              if (enabled) ...[
                const SizedBox(height: 8),
                _UploadButton(
                  label: 'Cambiar imagen de portada',
                  busy: _uploading == 'hero',
                  onPressed: _uploading == null ? () => _changeImage('hero') : null,
                ),
              ],
              if (_imageNotice['hero'] != null) ...[
                const SizedBox(height: 6),
                Text(
                  _imageNotice['hero']!,
                  style: const TextStyle(fontSize: 12.5, color: Brand.warning, height: 1.3),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// Botón "Cambiar …" de una imagen: mientras sube muestra el círculo.
class _UploadButton extends StatelessWidget {
  const _UploadButton({required this.label, required this.busy, required this.onPressed});
  final String label;
  final bool busy;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => OutlinedButton.icon(
        onPressed: busy ? null : onPressed,
        icon: busy
            ? const SizedBox.square(
                dimension: 16,
                child: CircularProgressIndicator(strokeWidth: 2, color: Brand.gold),
              )
            : const Icon(Icons.photo_library_outlined, size: 18),
        // Un rótulo largo con letra grande baja de renglón en vez de cortarse.
        label: Text(busy ? 'Subiendo…' : label, textAlign: TextAlign.center),
      );
}

/// Muestra de color tocable.
class _Swatch extends StatelessWidget {
  const _Swatch({required this.color, required this.selected, required this.dim, required this.label, this.onTap});
  final Color color;
  final bool selected;
  final bool dim;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: GestureDetector(
        // Blanco de 48 dp (2026-11-14, pedido de Ale): la muestra de 40 dp
        // sola quedaba por debajo del mínimo cómodo para el dedo.
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(4),
          child: Opacity(
            opacity: dim ? 0.55 : 1,
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: selected ? c.text : c.border, width: selected ? 2.4 : 1),
              ),
              child: selected
                  ? Icon(
                      Icons.check_rounded,
                      size: 20,
                      color: ThemeData.estimateBrightnessForColor(color) == Brightness.dark
                          ? Colors.white
                          : Brand.goldFg,
                    )
                  : null,
            ),
          ),
        ),
      ),
    );
  }
}

class _SeasonChip extends StatelessWidget {
  const _SeasonChip({required this.option, required this.selected, this.onTap});
  final SeasonOption option;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Material(
      color: selected ? Brand.gold.withValues(alpha: 0.16) : c.surface2,
      borderRadius: BorderRadius.circular(99),
      child: InkWell(
        borderRadius: BorderRadius.circular(99),
        onTap: onTap,
        child: Container(
          // Mínimo 44 dp de alto: medía 37 y costaba acertarle con el dedo.
          constraints: const BoxConstraints(minHeight: 44),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(99),
            border: Border.all(color: selected ? Brand.gold : c.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 14,
                height: 14,
                decoration: BoxDecoration(color: parseHex(option.accent), shape: BoxShape.circle),
              ),
              const SizedBox(width: 8),
              Text(
                option.label,
                style: TextStyle(fontSize: 13, fontWeight: selected ? FontWeight.w800 : FontWeight.w600),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Un banner del inicio: miniatura, título y si está visible.
class _BannerTile extends StatelessWidget {
  const _BannerTile({required this.banner, required this.onTap});
  final BannerInfo banner;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return AdminCard(
      onTap: onTap,
      padding: const EdgeInsets.all(10),
      child: Row(
        children: [
          SizedBox(
            width: 84,
            height: 52,
            child: NetImage(banner.imageUrl, position: banner.position, radius: 10),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  banner.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                ),
                const SizedBox(height: 4),
                banner.isActive
                    ? const StateChip('Visible', color: Brand.success, icon: Icons.visibility_rounded)
                    : const StateChip('Oculto', color: Color(0xFF8D8C99), icon: Icons.visibility_off_rounded),
              ],
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: c.textFaint),
        ],
      ),
    );
  }
}
