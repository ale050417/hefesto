import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
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
/// del home, segundos entre banners, y el logo y los banners (se ven y se
/// editan los textos; subir imágenes se hace desde la web).
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
    // Los banners se editan en su propia pantalla: acá se muestran los últimos.
    final banners = ref.watch(adminConfigProvider).value?.tienda.banners ?? widget.initial.banners;
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
                child: BrandLogo(url: widget.initial.logoUrl, size: 52),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Logo', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                    const SizedBox(height: 2),
                    Text(
                      'El logo y las imágenes de los banners se cambian desde la web (acá todavía no se pueden subir fotos).',
                      style: TextStyle(fontSize: 12, color: c.textDim, height: 1.35),
                    ),
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
              Wrap(
                spacing: 10,
                runSpacing: 10,
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
              const SizedBox(height: 14),
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
                      activeColor: Brand.gold,
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
              'Todavía no hay banners. Los nuevos se cargan desde la web.',
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
      ],
    );
  }
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
        onTap: onTap,
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
            child: selected ? Icon(Icons.check_rounded, size: 20, color: ThemeData.estimateBrightnessForColor(color) == Brightness.dark ? Colors.white : Brand.goldFg) : null,
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
