// Acciones rápidas sobre un producto (destacar, publicar/archivar, eliminar).
// Las usan el listado y la ficha: misma confirmación, mismos avisos y misma
// invalidación de datos en los dos lados.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import 'catalogo_ui.dart';
import 'productos_models.dart';
import 'productos_providers.dart';

/// Corre la llamada, muestra el error del servidor si falla y, si sale bien,
/// refresca los datos y avisa. Devuelve `true` si salió bien.
Future<bool> _guard(
  BuildContext context,
  Future<void> Function() action, {
  required String done,
}) async {
  // El container sobrevive a la pantalla: se puede refrescar aunque la persona
  // ya haya salido (por ejemplo, al borrar desde la ficha).
  final container = ProviderScope.containerOf(context);
  try {
    await action();
  } on ApiException catch (e) {
    if (context.mounted) showSnack(context, e.message, error: true);
    return false;
  } catch (_) {
    if (context.mounted) {
      showSnack(context, 'Ocurrió un error inesperado. Probá de nuevo.', error: true);
    }
    return false;
  }
  container.invalidate(adminProductsProvider);
  container.invalidate(adminProductProvider);
  container.invalidate(homeProvider);
  if (context.mounted) showSnack(context, done);
  return true;
}

/// Destaca o saca de destacados.
Future<bool> toggleFeatured(
  BuildContext context, {
  required String id,
  required bool value,
}) {
  final repo = ProviderScope.containerOf(context).read(productosRepoProvider);
  return _guard(
    context,
    () => repo.setFeatured(id, value),
    done: value ? 'Producto destacado' : 'Ya no está destacado',
  );
}

/// Publica (`published`) o archiva (`archived`) un producto. Archivar pide
/// confirmación; publicar sin fotos se avisa antes de molestar al servidor
/// (que igual lo rechaza).
Future<bool> changeProductStatus(
  BuildContext context, {
  required String id,
  required String name,
  required ProductState target,
  required bool hasPhotos,
}) async {
  if (target == ProductState.published && !hasPhotos) {
    showSnack(
      context,
      'No se puede publicar un producto sin fotos. Sumale una desde su ficha.',
      error: true,
    );
    return false;
  }
  if (target == ProductState.archived) {
    final ok = await confirmDialog(
      context,
      title: '¿Archivar "$name"?',
      message: 'Deja de mostrarse en la tienda. Podés volver a publicarlo cuando quieras.',
      confirmLabel: 'Archivar',
    );
    if (!ok || !context.mounted) return false;
  }
  final repo = ProviderScope.containerOf(context).read(productosRepoProvider);
  return _guard(
    context,
    () => repo.setStatus(id, target),
    done: target == ProductState.published ? 'Producto publicado' : 'Producto archivado',
  );
}

/// Borra el producto para siempre (pide confirmación, con el mismo texto que la web).
Future<bool> deleteProduct(
  BuildContext context, {
  required String id,
  required String name,
}) async {
  final ok = await confirmDialog(
    context,
    title: '¿Eliminar "$name" para siempre?',
    message: 'Esta acción no se puede deshacer: se borran el producto, sus fotos y sus '
        'reseñas. Los pedidos que ya lo incluyen conservan su registro. Si solo querés '
        'sacarlo de la tienda, usá Archivar.',
    confirmLabel: 'Eliminar para siempre',
    destructive: true,
  );
  if (!ok || !context.mounted) return false;
  final repo = ProviderScope.containerOf(context).read(productosRepoProvider);
  return _guard(context, () => repo.delete(id), done: 'Producto eliminado');
}

/// Borra una foto del producto (pide confirmación).
Future<bool> deleteProductImage(
  BuildContext context, {
  required String productId,
  required String imageId,
  required bool isPrimary,
  required bool isLast,
  required bool published,
}) async {
  final ok = await confirmDialog(
    context,
    title: '¿Eliminar esta foto?',
    message: isLast
        ? (published
            ? 'Es la única foto y el producto está publicado: en la tienda se va a ver sin imagen. No se puede deshacer.'
            : 'Es la única foto: sin fotos no se puede publicar. No se puede deshacer.')
        : (isPrimary
            ? 'Es la portada: la siguiente foto pasa a ser la portada. No se puede deshacer.'
            : 'No se puede deshacer.'),
    // "Eliminar foto" y no "Eliminar": que no se confunda con borrar el producto.
    confirmLabel: 'Eliminar foto',
    destructive: true,
  );
  if (!ok || !context.mounted) return false;
  final repo = ProviderScope.containerOf(context).read(productosRepoProvider);
  return _guard(context, () => repo.deleteImage(productId, imageId), done: 'Foto eliminada');
}

/// Guarda el encuadre de una foto (lo que se eligió arrastrándola).
Future<bool> setImagePosition(
  BuildContext context, {
  required String productId,
  required String imageId,
  required String position,
}) {
  final repo = ProviderScope.containerOf(context).read(productosRepoProvider);
  return _guard(
    context,
    () => repo.setImagePosition(productId, imageId, position),
    done: 'Encuadre guardado',
  );
}

/// Guarda el orden nuevo de las fotos.
Future<bool> reorderProductImages(
  BuildContext context, {
  required String productId,
  required List<String> imageIds,
}) {
  final repo = ProviderScope.containerOf(context).read(productosRepoProvider);
  return _guard(
    context,
    () => repo.reorderImages(productId, imageIds),
    done: 'Orden de las fotos guardado',
  );
}

/// Elige cuál de las fotos YA cargadas es la portada (no sube archivos).
Future<bool> setPrimaryImage(
  BuildContext context, {
  required String productId,
  required String imageId,
}) {
  final repo = ProviderScope.containerOf(context).read(productosRepoProvider);
  return _guard(
    context,
    () => repo.setPrimaryImage(productId, imageId),
    done: 'Listo, esa foto es la portada',
  );
}
