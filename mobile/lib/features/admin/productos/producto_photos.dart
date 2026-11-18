import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/frame_editor.dart';
import '../../../core/widgets/modals.dart';
import '../../../core/widgets/photo_picker.dart';
import 'catalogo_ui.dart';
import 'productos_actions.dart';
import 'productos_models.dart';
import 'productos_providers.dart';

/// Fotos de un producto en su ficha. Con permiso de editar (pedido de Ale,
/// 2026-11-17: que se pueda hacer todo desde el teléfono) se suman fotos de la
/// galería o de la cámara, se elimina la que está a la vista, se elige cuál es
/// la portada, se acomoda el encuadre arrastrando y se cambia el orden
/// arrastrando las miniaturas (2026-11-18). Hasta [maxProductImages] fotos, como en la web.
class ProductGallery extends ConsumerStatefulWidget {
  const ProductGallery({super.key, required this.product, required this.canEdit});
  final AdminProductDetail product;
  final bool canEdit;

  @override
  ConsumerState<ProductGallery> createState() => _ProductGalleryState();
}

class _ProductGalleryState extends ConsumerState<ProductGallery> {
  /// Foto que se está viendo (por id: al recargar, la lista puede cambiar de
  /// orden o perder una foto). Null = la primera.
  String? _selId;

  /// Portada o eliminación en curso.
  bool _busy = false;

  /// "Subiendo foto 2 de 3…" mientras sube (null = no está subiendo).
  String? _progress;

  /// Aviso debajo de los botones (fotos que quedaron afuera, permiso negado).
  String? _notice;

  AdminProductDetail get _p => widget.product;
  int get _room => maxProductImages - _p.images.length;
  bool get _working => _busy || _progress != null;

  Future<void> _add({required bool camera}) async {
    if (_working || _room <= 0) return;
    // Color único con varios colores: se puede decir de qué color son las
    // fotos (la tienda salta a esa foto cuando el cliente elige el color).
    String? color;
    if (!_p.isMulti && _p.colors.length > 1) {
      final choice = await showAppSheet<String>(
        context,
        builder: (_) => _PhotoColorSheet(colors: _p.colors),
      );
      if (choice == null || !mounted) return; // cerró la hoja: no sube nada
      color = choice.isEmpty ? null : choice;
    }

    final container = ProviderScope.containerOf(context, listen: false);
    final messenger = ScaffoldMessenger.of(context);
    setState(() {
      _notice = null;
      _progress = 'Abriendo…';
    });
    List<PickedPhoto> picked;
    try {
      final source = ref.read(photoSourceProvider);
      if (camera) {
        final one = await source.fromCamera();
        picked = [?one];
      } else {
        picked = await source.fromGallery();
      }
    } catch (_) {
      // Lo más común: el permiso de cámara o de fotos negado en el teléfono.
      if (mounted) {
        setState(() {
          _progress = null;
          _notice = camera
              ? 'No pudimos abrir la cámara. Revisá el permiso en los ajustes del teléfono.'
              : 'No pudimos abrir tus fotos. Revisá el permiso en los ajustes del teléfono.';
        });
      }
      return;
    }
    if (!mounted) return;
    final res = filterPhotos(picked, room: _room, max: maxProductImages);
    if (res.ok.isEmpty) {
      setState(() {
        _progress = null;
        _notice = res.notice;
      });
      return;
    }

    final repo = ref.read(productosRepoProvider);
    final id = _p.id;
    String? reason;
    final failed = await uploadOneByOne<PickedPhoto>(
      res.ok,
      (photo) => repo.addImage(id, photo, color: color),
      onProgress: (i, n) {
        if (mounted) setState(() => _progress = uploadProgressLabel(i, n));
      },
      onError: (e) => reason = e is ApiException ? e.message : null,
    );
    // Aunque alguna falle, las que subieron ya están: se vuelve a pedir todo.
    container.invalidate(adminProductsProvider);
    container.invalidate(adminProductProvider);
    container.invalidate(homeProvider);
    final total = res.ok.length;
    final okCount = total - failed;
    final failure = failed == 0
        ? null
        // Con una sola foto se muestra el motivo del servidor.
        : (total == 1 && reason != null ? reason : uploadFailureNotice(failed, total));
    if (mounted) {
      setState(() {
        _progress = null;
        _notice = [?res.notice, ?failure].join(' ');
        if (_notice!.isEmpty) _notice = null;
      });
    }
    if (okCount > 0) {
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(okCount == 1 ? 'Foto agregada' : '$okCount fotos agregadas')));
    }
  }

  Future<void> _makePrimary(AdminProductImage img) async {
    if (_working) return;
    setState(() => _busy = true);
    await setPrimaryImage(context, productId: _p.id, imageId: img.id);
    if (!mounted) return;
    setState(() => _busy = false);
  }

  /// Orden recién arrastrado (ids) hasta que llega la lista nueva del servidor.
  List<String>? _order;

  /// Las fotos en el orden que se ve: el arrastrado si todavía vale.
  List<AdminProductImage> get _images {
    final images = _p.images;
    final order = _order;
    if (order == null || order.length != images.length) return images;
    final byId = {for (final i in images) i.id: i};
    if (!order.every(byId.containsKey)) return images;
    return [for (final id in order) byId[id]!];
  }

  /// Soltaron una miniatura en otro lugar.
  Future<void> _move(int from, int to) async {
    if (_working) return;
    if (to == from) return;
    final ids = [for (final i in _images) i.id];
    ids.insert(to, ids.removeAt(from));
    setState(() {
      _order = ids;
      _busy = true;
      _notice = null;
    });
    final ok = await reorderProductImages(context, productId: _p.id, imageIds: ids);
    if (!mounted) return;
    setState(() {
      _busy = false;
      if (!ok) _order = null; // no se guardó: vuelve al orden del servidor
    });
  }

  /// Abre "Acomodar foto": se arrastra en un recuadro cuadrado, como la
  /// muestra la tienda, y se guarda el encuadre.
  Future<void> _frame(AdminProductImage img) async {
    if (_working) return;
    final position = await Navigator.of(context).push<String>(
      MaterialPageRoute(
        builder: (_) => FrameEditorScreen(
          title: 'Acomodar foto',
          aspectRatio: 1,
          url: img.url,
          initial: img.position ?? '50% 50%',
          help: 'Así se ve en las tarjetas de la tienda. Arrastrá la foto para elegir qué parte se ve.',
        ),
      ),
    );
    if (position == null || !mounted) return;
    setState(() => _busy = true);
    await setImagePosition(context, productId: _p.id, imageId: img.id, position: position);
    if (!mounted) return;
    setState(() => _busy = false);
  }

  Future<void> _delete(AdminProductImage img) async {
    if (_working) return;
    setState(() {
      _busy = true;
      _notice = null;
    });
    final ok = await deleteProductImage(
      context,
      productId: _p.id,
      imageId: img.id,
      isPrimary: img.isPrimary,
      isLast: _p.images.length == 1,
      published: _p.status == ProductState.published,
    );
    if (!mounted) return;
    setState(() {
      _busy = false;
      if (ok) _selId = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final images = _images;
    final canEdit = widget.canEdit;

    if (images.isEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: canEdit ? 150 : 190,
            width: double.infinity,
            decoration: BoxDecoration(
              color: c.surface2,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: c.border),
            ),
            alignment: Alignment.center,
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.no_photography_outlined, size: 40, color: c.textFaint),
                const SizedBox(height: 8),
                const Text('Sin fotos', style: TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(
                  'Sin fotos no se puede publicar.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12, color: c.textDim),
                ),
              ],
            ),
          ),
          if (canEdit) ..._addControls(c),
        ],
      );
    }

    final found = images.indexWhere((i) => i.id == _selId);
    final index = found < 0 ? 0 : found;
    final sel = images[index];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Stack(
          children: [
            AspectRatio(
              aspectRatio: 1.15,
              child: NetImage(sel.url, position: sel.position, radius: 20),
            ),
            if (sel.isPrimary)
              const Positioned(
                left: 10,
                top: 10,
                child: InfoPill(label: 'Portada', icon: Icons.star_rounded, color: Brand.gold),
              ),
            if (sel.color != null)
              Positioned(
                right: 10,
                bottom: 10,
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 180),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: c.surface1.withValues(alpha: 0.85),
                    borderRadius: BorderRadius.circular(99),
                    border: Border.all(color: c.border),
                  ),
                  child: Text(
                    sel.color!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
          ],
        ),
        if (images.length > 1) ...[
          const SizedBox(height: 10),
          SizedBox(
            height: 62,
            // Con permiso, se mantiene apretada una miniatura y se arrastra
            // para cambiar el orden (pedido de Ale, 2026-11-18).
            child: ReorderableListView.builder(
              scrollDirection: Axis.horizontal,
              buildDefaultDragHandles: canEdit && !_working,
              itemCount: images.length,
              onReorderItem: _move,
              proxyDecorator: (child, _, _) => Material(color: Colors.transparent, child: child),
              itemBuilder: (_, i) {
                final img = images[i];
                final selected = i == index;
                return Semantics(
                  key: ValueKey(img.id),
                  button: true,
                  selected: selected,
                  label: 'Foto ${i + 1} de ${images.length}',
                  child: GestureDetector(
                    onTap: () => setState(() => _selId = img.id),
                    child: Container(
                      width: 62,
                      margin: const EdgeInsets.only(right: 8),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: selected ? Brand.gold : c.border,
                          width: selected ? 2 : 1,
                        ),
                      ),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          NetImage(img.url, position: img.position, radius: 12),
                          if (img.isPrimary)
                            const Positioned(
                              right: 3,
                              top: 3,
                              child: Icon(Icons.star_rounded, size: 16, color: Brand.gold),
                            ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
        if (canEdit) ...[
          if (images.length > 1) ...[
            const SizedBox(height: 6),
            Text(
              'Mantené apretada una foto y arrastrala para cambiar el orden.',
              style: TextStyle(fontSize: 11.5, color: c.textFaint, height: 1.3),
            ),
          ],
          const SizedBox(height: 10),
          // Sobre la foto que se está viendo.
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton.icon(
                onPressed: _working ? null : () => _frame(sel),
                icon: const Icon(Icons.open_with_rounded, size: 18),
                label: const Text('Acomodar'),
              ),
              if (!sel.isPrimary)
                OutlinedButton.icon(
                  onPressed: _working ? null : () => _makePrimary(sel),
                  icon: const Icon(Icons.star_outline_rounded, size: 18),
                  label: const Text('Usar como portada'),
                ),
              OutlinedButton.icon(
                onPressed: _working ? null : () => _delete(sel),
                icon: const Icon(Icons.delete_outline_rounded, size: 18),
                label: const Text('Eliminar foto'),
              ),
            ],
          ),
          ..._addControls(c),
        ],
      ],
    );
  }

  /// "Sumar fotos" / "Sacar foto", cuántas van y el aviso o el avance.
  List<Widget> _addControls(HefestoColors c) {
    final count = _p.images.length;
    final canAdd = !_working && _room > 0;
    return [
      const SizedBox(height: 10),
      // Wrap y no Row: con letra grande en un teléfono angosto los dos botones
      // no entran lado a lado y el segundo baja de renglón.
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          OutlinedButton.icon(
            onPressed: canAdd ? () => _add(camera: false) : null,
            icon: const Icon(Icons.photo_library_outlined, size: 18),
            label: const Text('Sumar fotos'),
          ),
          OutlinedButton.icon(
            onPressed: canAdd ? () => _add(camera: true) : null,
            icon: const Icon(Icons.photo_camera_outlined, size: 18),
            label: const Text('Sacar foto'),
          ),
        ],
      ),
      const SizedBox(height: 6),
      if (_progress != null)
        Row(
          children: [
            const SizedBox.square(
              dimension: 14,
              child: AppSpinner(),
            ),
            const SizedBox(width: 8),
            Expanded(child: Text(_progress!, style: TextStyle(fontSize: 12.5, color: c.textDim))),
          ],
        )
      else
        Text(
          count == 0
              ? 'Hasta $maxProductImages fotos (JPG, PNG o WebP, de hasta 4 MB). La primera queda de portada.'
              : _room > 0
                  ? '$count de $maxProductImages fotos.'
                  : 'Llegaste al tope de $maxProductImages fotos: eliminá una para sumar otra.',
          style: TextStyle(fontSize: 12, color: c.textDim, height: 1.35),
        ),
      if (_notice != null) ...[
        const SizedBox(height: 6),
        Text(_notice!, style: const TextStyle(fontSize: 12.5, color: Brand.warning, height: 1.3)),
      ],
    ];
  }
}

/// "¿De qué color son las fotos?": devuelve el color, o `''` si no son de uno
/// en particular (null = se cerró sin elegir).
class _PhotoColorSheet extends StatelessWidget {
  const _PhotoColorSheet({required this.colors});
  final List<String> colors;

  @override
  Widget build(BuildContext context) => SheetBody(
        title: '¿De qué color son las fotos?',
        subtitle: 'Cuando el cliente elige ese color, la tienda le muestra esa foto.',
        children: [
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.photo_outlined),
            title: const Text('De ninguno en particular'),
            onTap: () => Navigator.of(context).pop(''),
          ),
          for (final color in colors)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.palette_outlined),
              title: Text(color),
              onTap: () => Navigator.of(context).pop(color),
            ),
        ],
      );
}
