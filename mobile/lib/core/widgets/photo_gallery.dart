// Fotos ya subidas (direcciones del servidor): la tira de miniaturas de una
// tarjeta ([PhotoStrip]) y la foto a pantalla completa con zoom
// ([PhotoViewerScreen]).

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'common.dart';

/// Miniaturas de las fotos de un registro. Tocar una la abre a pantalla
/// completa (sobre todo, también sobre la barra del panel).
class PhotoStrip extends StatelessWidget {
  const PhotoStrip({super.key, required this.urls, this.size = 72});
  final List<String> urls;
  final double size;

  @override
  Widget build(BuildContext context) {
    if (urls.isEmpty) return const SizedBox.shrink();
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (var i = 0; i < urls.length; i++)
          Semantics(
            button: true,
            label: 'Foto ${i + 1} de ${urls.length}',
            child: GestureDetector(
              onTap: () => Navigator.of(context, rootNavigator: true).push<void>(
                MaterialPageRoute(builder: (_) => PhotoViewerScreen(urls: urls, initial: i)),
              ),
              child: SizedBox.square(dimension: size, child: NetImage(urls[i], radius: 12)),
            ),
          ),
      ],
    );
  }
}

/// Fotos a pantalla completa: se pasa de una a otra deslizando y se agranda
/// con dos dedos (hasta 5×) para ver el detalle de una pieza.
class PhotoViewerScreen extends StatefulWidget {
  const PhotoViewerScreen({super.key, required this.urls, this.initial = 0});
  final List<String> urls;
  final int initial;

  @override
  State<PhotoViewerScreen> createState() => _PhotoViewerScreenState();
}

class _PhotoViewerScreenState extends State<PhotoViewerScreen> {
  late final PageController _pages = PageController(initialPage: widget.initial);
  late int _index = widget.initial;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final n = widget.urls.length;
    final broken = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.broken_image_outlined, size: 44, color: c.textFaint),
        const SizedBox(height: 10),
        Text('No pudimos cargar la foto.', style: TextStyle(color: c.textDim)),
      ],
    );
    return Scaffold(
      appBar: AppBar(title: Text(n > 1 ? 'Foto ${_index + 1} de $n' : 'Foto')),
      body: SafeArea(
        top: false,
        child: PageView.builder(
          controller: _pages,
          itemCount: n,
          onPageChanged: (i) => setState(() => _index = i),
          itemBuilder: (_, i) => InteractiveViewer(
            minScale: 1,
            maxScale: 5,
            child: Center(
              child: debugDisableNetworkImages
                  ? broken
                  : CachedNetworkImage(
                      imageUrl: widget.urls[i],
                      fit: BoxFit.contain,
                      fadeInDuration: const Duration(milliseconds: 160),
                      placeholder: (_, _) => const LoadingView(),
                      errorWidget: (_, _, _) => broken,
                    ),
            ),
          ),
        ),
      ),
    );
  }
}
