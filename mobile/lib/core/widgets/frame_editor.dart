// Acomodar una imagen con el dedo (pedido de Ale, 2026-11-18: "no me deja
// arrastrar nada cuando cambio banners o fotos… una vista previa para acomodar
// o recortar"). La tienda recorta cada imagen a la forma de su lugar (el banner
// apaisado, la foto del producto cuadrada) y guarda QUÉ PARTE se ve como un
// encuadre "x% y%", igual que la web. Acá ese encuadre se elige arrastrando la
// imagen dentro de un recuadro con la misma forma: lo que se ve es lo que
// queda. La imagen original no se toca, así que siempre se puede volver a
// acomodar.

import 'dart:typed_data';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'common.dart';

/// "78% 0%" → (78, 0). Lo que no se entiende vale el centro.
(double, double) positionPercents(String? position) {
  final parts = (position ?? '').trim().split(RegExp(r'\s+'));
  double axis(int i) {
    if (parts.length < 2) return 50;
    final v = double.tryParse(parts[i].replaceAll('%', ''));
    return (v ?? 50).clamp(0, 100).toDouble();
  }

  return (axis(0), axis(1));
}

/// (78.4, 0) → "78% 0%".
String formatPosition(double x, double y) =>
    '${x.clamp(0, 100).round()}% ${y.clamp(0, 100).round()}%';

/// Cuánto sobra de la imagen a cada lado cuando llena un recuadro de [box]
/// (lo que queda afuera y se puede traer arrastrando). (0, 0) si entra justa.
Size coverOverflow(Size image, Size box) {
  if (image.width <= 0 || image.height <= 0 || box.width <= 0 || box.height <= 0) return Size.zero;
  final scale = (box.width / image.width) > (box.height / image.height)
      ? box.width / image.width
      : box.height / image.height;
  final w = image.width * scale - box.width;
  final h = image.height * scale - box.height;
  return Size(w < 0.5 ? 0 : w, h < 0.5 ? 0 : h);
}

/// El encuadre después de arrastrar [delta] píxeles: la imagen sigue al dedo
/// (arrastrar hacia abajo muestra lo de más arriba).
String dragPosition(String? position, Offset delta, Size overflow) {
  var (x, y) = positionPercents(position);
  if (overflow.width > 0) x -= delta.dx / overflow.width * 100;
  if (overflow.height > 0) y -= delta.dy / overflow.height * 100;
  return formatPosition(x, y);
}

/// Recuadro con la forma en que la tienda muestra la imagen. Con [onChanged]
/// la imagen se arrastra para elegir qué parte se ve; sin él solo se mira.
/// La imagen viene de [bytes] (recién elegida en el teléfono) o de [url].
class FramingBox extends StatefulWidget {
  const FramingBox({
    super.key,
    this.bytes,
    this.url,
    required this.aspectRatio,
    required this.position,
    this.onChanged,
    this.radius = 16,
  });

  final Uint8List? bytes;
  final String? url;
  final double aspectRatio;
  final String position;
  final ValueChanged<String>? onChanged;
  final double radius;

  @override
  State<FramingBox> createState() => _FramingBoxState();
}

class _FramingBoxState extends State<FramingBox> {
  ImageStream? _stream;
  late final ImageStreamListener _listener = ImageStreamListener(
    (info, _) {
      if (!mounted) return;
      setState(() => _imageSize = Size(info.image.width.toDouble(), info.image.height.toDouble()));
    },
    onError: (_, _) {},
  );

  /// Tamaño real de la imagen (null hasta que carga, o si no se pudo leer).
  Size? _imageSize;

  ImageProvider? get _provider {
    if (widget.bytes != null) return MemoryImage(widget.bytes!);
    final url = widget.url;
    if (url == null || url.isEmpty || debugDisableNetworkImages) return null;
    return CachedNetworkImageProvider(url);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _resolve();
  }

  @override
  void didUpdateWidget(FramingBox old) {
    super.didUpdateWidget(old);
    if (!identical(old.bytes, widget.bytes) || old.url != widget.url) {
      _imageSize = null;
      _resolve();
    }
  }

  void _resolve() {
    final next = _provider?.resolve(createLocalImageConfiguration(context));
    if (next?.key == _stream?.key) return;
    _stream?.removeListener(_listener);
    _stream = next;
    _stream?.addListener(_listener);
  }

  @override
  void dispose() {
    _stream?.removeListener(_listener);
    super.dispose();
  }

  void _drag(Offset delta, Size box) {
    final onChanged = widget.onChanged;
    if (onChanged == null) return;
    // Sin el tamaño real (todavía cargando) se mueve como si sobrara un
    // recuadro entero en cada sentido: responde igual y se afina al cargar.
    final size = _imageSize;
    final overflow = size == null ? box : coverOverflow(size, box);
    final next = dragPosition(widget.position, delta, overflow);
    if (next != widget.position) onChanged(next);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final provider = _provider;
    final editable = widget.onChanged != null;
    final empty = ColoredBox(
      color: c.surface2,
      child: Center(child: Icon(Icons.image_outlined, color: c.textFaint, size: 30)),
    );
    return AspectRatio(
      aspectRatio: widget.aspectRatio,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final box = constraints.biggest;
          final size = _imageSize;
          final overflow = size == null ? null : coverOverflow(size, box);
          // Entra justa (misma forma que el recuadro): no hay nada que mover.
          final fixed = overflow != null && overflow == Size.zero;
          final picture = ClipRRect(
            borderRadius: BorderRadius.circular(widget.radius),
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (provider == null)
                  empty
                else
                  Image(
                    image: provider,
                    fit: BoxFit.cover,
                    alignment: parsePosition(widget.position),
                    gaplessPlayback: true,
                    errorBuilder: (_, _, _) => empty,
                  ),
                if (editable)
                  Positioned(
                    left: 8,
                    bottom: 8,
                    right: 8,
                    child: Align(
                      alignment: Alignment.bottomLeft,
                      child: _Hint(fixed ? 'La imagen entra completa' : 'Arrastrá para acomodar', moves: !fixed),
                    ),
                  ),
              ],
            ),
          );
          if (!editable) return picture;
          return Semantics(
            label: 'Vista previa. Arrastrá la imagen para elegir qué parte se ve.',
            // Dos arrastres (y no un "pan"): así el recuadro le gana al
            // desplazamiento de la pantalla cuando se arrastra hacia arriba o
            // abajo, que es justo lo que más se usa en un banner apaisado.
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onHorizontalDragUpdate: (d) => _drag(Offset(d.delta.dx, 0), box),
              onVerticalDragUpdate: (d) => _drag(Offset(0, d.delta.dy), box),
              child: picture,
            ),
          );
        },
      ),
    );
  }
}

class _Hint extends StatelessWidget {
  const _Hint(this.text, {required this.moves});
  final String text;
  final bool moves;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: c.bg.withValues(alpha: 0.78),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: c.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(moves ? Icons.open_with_rounded : Icons.check_rounded, size: 13, color: c.text),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: c.text),
            ),
          ),
        ],
      ),
    );
  }
}

/// Pantalla "Acomodar": la imagen en la forma en que la muestra la tienda,
/// para arrastrarla y guardar. Devuelve el encuadre nuevo, o null si se salió
/// sin guardar o no se cambió nada.
class FrameEditorScreen extends StatefulWidget {
  const FrameEditorScreen({
    super.key,
    required this.title,
    required this.aspectRatio,
    required this.initial,
    this.url,
    this.bytes,
    this.help,
  });

  final String title;
  final double aspectRatio;
  final String initial;
  final String? url;
  final Uint8List? bytes;

  /// Dónde se ve esta imagen ("Así se ve en las tarjetas de la tienda.").
  final String? help;

  @override
  State<FrameEditorScreen> createState() => _FrameEditorScreenState();
}

class _FrameEditorScreenState extends State<FrameEditorScreen> {
  late String _position = widget.initial;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final changed = _position != widget.initial;
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    FramingBox(
                      url: widget.url,
                      bytes: widget.bytes,
                      aspectRatio: widget.aspectRatio,
                      position: _position,
                      onChanged: (p) => setState(() => _position = p),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      widget.help ?? 'Arrastrá la imagen para elegir qué parte se ve.',
                      style: TextStyle(fontSize: 13, color: c.textDim, height: 1.4),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'La imagen original no se recorta: podés volver a acomodarla cuando quieras.',
                      style: TextStyle(fontSize: 12, color: c.textFaint, height: 1.4),
                    ),
                    const SizedBox(height: 12),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: OutlinedButton.icon(
                        onPressed: _position == '50% 50%' ? null : () => setState(() => _position = '50% 50%'),
                        icon: const Icon(Icons.filter_center_focus_rounded, size: 18),
                        label: const Text('Centrar'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: GoldButton(
                label: 'Guardar encuadre',
                icon: Icons.check_rounded,
                onPressed: changed ? () => Navigator.of(context).pop(_position) : null,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
