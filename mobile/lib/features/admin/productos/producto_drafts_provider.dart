import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/providers.dart';
import 'producto_drafts.dart';

/// Borradores locales del formulario de producto, guardados en el teléfono
/// (ver `producto_drafts.dart`). Quien lo mira se entera de cada cambio: el
/// listado muestra "Borradores sin guardar (2)" y la hoja, la lista.
class ProductDraftsController extends Notifier<ProductDraftBook> {
  static const storageKey = 'product_drafts';

  SharedPreferences? _prefs;

  @override
  ProductDraftBook build() {
    try {
      _prefs = ref.read(sharedPrefsProvider);
    } catch (_) {
      // Sin almacenamiento (no debería pasar en la app): los borradores viven
      // en memoria; el formulario nunca se rompe por esto.
      _prefs = null;
    }
    try {
      return ProductDraftBook.decode(_prefs?.getString(storageKey));
    } catch (_) {
      return ProductDraftBook.empty;
    }
  }

  void _set(ProductDraftBook next) {
    // Puede llegar tarde (al cerrarse una pantalla) con la app ya desarmada.
    if (!ref.mounted) return;
    state = next;
    // No se espera: si el guardado en disco falla, no hay nada útil que
    // mostrarle a la persona y el borrador sigue en memoria.
    _prefs?.setString(storageKey, next.encode()).catchError((_) => false);
  }

  /// Guarda o actualiza un borrador de producto nuevo.
  void save(ProductDraft draft) => _set(state.save(draft));

  /// Lo saca (se creó el producto, o la persona lo eliminó).
  void remove(String id) {
    if (state.byId(id) != null) _set(state.remove(id));
  }

  /// Guarda la edición a medias de un producto.
  void saveEdit(ProductDraft draft) => _set(state.saveEdit(draft));

  void removeEdit(String productId) {
    if (state.editOf(productId) != null) _set(state.removeEdit(productId));
  }
}

final productDraftsProvider =
    NotifierProvider<ProductDraftsController, ProductDraftBook>(ProductDraftsController.new);
