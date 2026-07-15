import React, { useState, useMemo } from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch, // <-- Añade esta pequeña herramienta
  setDoc, // <--- ¡AÑADE ESTA NUEVA HERRAMIENTA!
} from "firebase/firestore";

export default function Historial({
  articulos,
  listaPedidos,
  usuarioActual,
  listaAlmacenes = [],
}) {
  const [busquedaHistorial, setBusquedaHistorial] = useState("");
  const [filtroFechaExacta, setFiltroFechaExacta] = useState("");
  const [filtroMes, setFiltroMes] = useState("");
  const [filtroAnio, setFiltroAnio] = useState("");
  const [filtroEstado, setFiltroEstado] = useState(""); // Puede ser "Pendiente" o "Completado"
  const [mostrarFiltroEstado, setMostrarFiltroEstado] = useState(false);

  // ==========================================
  // 🕒 MÁQUINA DEL TIEMPO (DESHACER)
  // ==========================================
  const [historialDeshacer, setHistorialDeshacer] = useState([]);

  // Función para "fotografiar" los datos antes de destruirlos
  const registrarDeshacer = (tipoAccion, documentosPrevios) => {
    setHistorialDeshacer((prev) => {
      const nuevoHistorial = [
        ...prev,
        { tipo: tipoAccion, documentos: documentosPrevios },
      ];
      // Si superamos los 5 registros, eliminamos el más antiguo (el primero)
      if (nuevoHistorial.length > 5) nuevoHistorial.shift();
      return nuevoHistorial;
    });
  };

  // Función que se ejecuta al pulsar el botón "Deshacer"
  const ejecutarDeshacer = async () => {
    if (historialDeshacer.length === 0) return;

    // 1. Sacamos la última acción de nuestra memoria
    const ultimaAccion = historialDeshacer[historialDeshacer.length - 1];
    const batch = writeBatch(db); // Usamos un lote para que sea súper rápido

    try {
      if (ultimaAccion.tipo === "BORRAR") {
        // Si la acción fue borrar, restauramos los documentos con su ID original
        ultimaAccion.documentos.forEach((docPrevio) => {
          const docRef = doc(db, "pedidos", docPrevio.id);
          const dataGuardar = { ...docPrevio.data };
          delete dataGuardar.id; // Limpiamos el ID de los datos internos por limpieza
          batch.set(docRef, dataGuardar); // setDoc re-crea el documento exactamente como era
        });
      }

      // 2. Enviamos los datos restaurados a la nube
      await batch.commit();

      // 3. Borramos esta acción de nuestra máquina del tiempo porque ya la hemos deshecho
      setHistorialDeshacer((prev) => prev.slice(0, -1));
    } catch (error) {
      console.error("Error al deshacer:", error);
      alert("Hubo un error al intentar deshacer la acción.");
    }
  };
  // Añade esta nueva línea:
  const [mostrarFiltroFecha, setMostrarFiltroFecha] = useState(false);
  // Memoria universal para el resto de columnas: { almacen: "Urgencias", gc: "123" }
  const [filtrosColumna, setFiltrosColumna] = useState({});
  const [menuColumnaAbierto, setMenuColumnaAbierto] = useState(null); // Saber qué menú está abierto
  const [busquedaMenu, setBusquedaMenu] = useState(""); // Buscador interno de la ventana emergente
  // Memoria temporal (Borrador) para no filtrar hasta darle a Aceptar
  const [seleccionesTemporales, setSeleccionesTemporales] = useState([]);
  // ❌ HEMOS ELIMINADO EL ESTADO 'filaHover' QUE CONGELABA LA APP
  const [filaEditando, setFilaEditando] = useState(null);
  const [tempPedido, setTempPedido] = useState({});

  const [seleccionados, setSeleccionados] = useState([]);
  const [loteOt, setLoteOt] = useState("");

  const hoy = new Date();
  const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(hoy.getDate()).padStart(2, "0")}`;
  const [loteFecha, setLoteFecha] = useState(fechaHoy);

  const [mostrarModalNuevo, setMostrarModalNuevo] = useState(false);
  const [mostrarModalImportar, setMostrarModalImportar] = useState(false);
  const [textoImportacion, setTextoImportacion] = useState("");

  const pedidoVacio = {
    dias: 0,
    fecha: fechaHoy,
    almacen: "",
    gc: "",
    articulo: "",
    unidades: "",
    tipo_articulo: "",
    observaciones: "",
    n_pedido: "",
    importe: "",
    ot: "-",
    fecha_recepcion: "-",
    coste_unitario: "0.00 €",
  };

  const [nuevosPedidos, setNuevosPedidos] = useState([pedidoVacio]);
  // Calculadora automática de días de demora
  const calcularDias = (fechaPedido, fechaRecepcion) => {
    // Si no hay fecha de creación válida, devolvemos 0
    if (!fechaPedido || fechaPedido === "-" || fechaPedido === "nan") return 0;

    const fechaInicio = new Date(fechaPedido);

    // Si hay una fecha de recepción real, paramos el reloj ahí. Si no, usamos HOY().
    const fechaFin =
      fechaRecepcion &&
      fechaRecepcion !== "-" &&
      fechaRecepcion !== "nan" &&
      fechaRecepcion !== ""
        ? new Date(fechaRecepcion)
        : new Date();

    // La resta matemática de fechas nos da milisegundos. Lo convertimos a días enteros.
    const diferenciaMs = fechaFin - fechaInicio;
    const dias = Math.floor(diferenciaMs / (1000 * 60 * 60 * 24));

    return dias >= 0 ? dias : 0; // Evita días negativos si hay un error tipográfico
  };
  const [inputEscaner, setInputEscaner] = useState("");
  const [mostrarSelectorCatalogo, setMostrarSelectorCatalogo] = useState(false);
  const [mostrarModalAlertas, setMostrarModalAlertas] = useState(false);
  const [busquedaMiniCatalogo, setBusquedaMiniCatalogo] = useState("");
  const [columnaMiniCatalogo, setColumnaMiniCatalogo] = useState("todas");
  const [articulosSeleccionados, setArticulosSeleccionados] = useState([]);

  // ==========================================
  // 🤖 CEREBRO PREDICTIVO (TOP 10 ALERTAS)
  // ==========================================
  const topAlertas = useMemo(() => {
    // Si la ventana no está abierta, no forzamos a la app a hacer matemáticas complejas
    if (!mostrarModalAlertas) return [];

    const resultados = [];
    const hoy = new Date();

    articulos.forEach((art) => {
      const susPedidos = listaPedidos.filter(
        (p) =>
          p.gc === art.gc && p.fecha && p.fecha !== "-" && p.fecha !== "nan"
      );

      const fechas = susPedidos
        .map((p) => new Date(p.fecha))
        .filter((d) => !isNaN(d.getTime()))
        .sort((a, b) => a - b);

      if (fechas.length >= 2) {
        const primeraFecha = fechas[0];
        const ultimaFecha = fechas[fechas.length - 1];
        const diasTotales =
          (ultimaFecha - primeraFecha) / (1000 * 60 * 60 * 24);
        const frecuenciaMedia = diasTotales / (fechas.length - 1);
        const diasDesdeUltimo = (hoy - ultimaFecha) / (1000 * 60 * 60 * 24);
        const diasRestantes = Math.round(frecuenciaMedia - diasDesdeUltimo);

        // Filtramos solo los artículos con stock crítico o en alerta (<= 4 días)
        if (diasRestantes <= 4) {
          resultados.push({ ...art, diasRestantes });
        }
      }
    });

    // Ordenamos de más urgente a menos urgente y nos quedamos con los 10 primeros
    return resultados
      .sort((a, b) => a.diasRestantes - b.diasRestantes)
      .slice(0, 10);
  }, [articulos, listaPedidos, mostrarModalAlertas]);

  // ==========================================
  // 🚀 OPTIMIZACIÓN EXTREMA: useMemo
  // Solo recalcula cuando cambian los pedidos o la búsqueda, NO al mover el ratón.
  // ==========================================
  const pedidosFiltrados = useMemo(() => {
    // 1. Filtrar por permisos y búsqueda
    let filtrados = listaPedidos.filter((pedido) => {
      const tienePermiso =
        usuarioActual.rol === "admin" ||
        usuarioActual.almacenes.some(
          (almacenPermitido) =>
            pedido.almacen && pedido.almacen.includes(almacenPermitido)
        );

      if (!tienePermiso) return false;

      const busqueda = busquedaHistorial.toLowerCase();
      return (
        (pedido.n_pedido && pedido.n_pedido.toLowerCase().includes(busqueda)) ||
        (pedido.gc && pedido.gc.toLowerCase().includes(busqueda)) ||
        (pedido.articulo && pedido.articulo.toLowerCase().includes(busqueda)) ||
        (pedido.ot && pedido.ot.toLowerCase().includes(busqueda))
      );
    });
    // --- PROTOCOLO DE RESETEO DE FILTROS ---
    const limpiarTodosLosFiltros = () => {
      setFiltrosColumna({});
      setFiltroFechaExacta("");
      setFiltroMes("");
      setFiltroAnio("");
      setFiltroEstado("");
      setBusquedaHistorial(""); // Opcional, pero muy útil para una limpieza total
    };
    // --- NUEVA CRIBA: FILTROS DE FECHA ---
    if (filtroFechaExacta) {
      // Si busca un día exacto, tiene que coincidir plenamente
      filtrados = filtrados.filter((p) => p.fecha === filtroFechaExacta);
    } else if (filtroMes) {
      // Si busca un mes, miramos que la fecha empiece por "AÑO-MES"
      filtrados = filtrados.filter(
        (p) => p.fecha && p.fecha.startsWith(filtroMes)
      );
    } else if (filtroAnio) {
      // Si busca un año, miramos que la fecha empiece por "AÑO"
      filtrados = filtrados.filter(
        (p) => p.fecha && p.fecha.startsWith(filtroAnio)
      );
    }

    /// --- NUEVA CRIBA: FILTROS DINÁMICOS MÚLTIPLES ---
    Object.keys(filtrosColumna).forEach((campoBD) => {
      const selecciones = filtrosColumna[campoBD];
      // Si hay selecciones guardadas para esta columna y la cesta no está vacía
      if (selecciones && selecciones.length > 0) {
        filtrados = filtrados.filter((p) =>
          selecciones.includes(String(p[campoBD]))
        );
      }
    });
    // --- NUEVA CRIBA: ESTADO (Columna Acciones) ---
    if (filtroEstado === "Completado") {
      filtrados = filtrados.filter(
        (p) =>
          p.fecha_recepcion &&
          p.fecha_recepcion !== "nan" &&
          p.fecha_recepcion !== "-" &&
          p.fecha_recepcion !== ""
      );
    } else if (filtroEstado === "Pendiente") {
      filtrados = filtrados.filter(
        (p) =>
          !p.fecha_recepcion ||
          p.fecha_recepcion === "nan" ||
          p.fecha_recepcion === "-" ||
          p.fecha_recepcion === ""
      );
    }

    // 2. Ordenar de más reciente a antiguo (hacerlo solo con los ya filtrados es mucho más rápido)
    return filtrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }, [
    listaPedidos,
    usuarioActual,
    busquedaHistorial,
    filtroFechaExacta,
    filtroMes,
    filtroAnio,
    filtrosColumna,
    filtroEstado,
  ]);

  // ==========================================
  // CONEXIÓN CON FIREBASE (ESCRITURA)
  // ==========================================

  const guardarNuevosPedidos = async (e) => {
    e.preventDefault();
    const pedidosValidos = nuevosPedidos.filter((p) => p.gc.trim() !== "");

    if (pedidosValidos.length > 0) {
      try {
        // 1. Creamos nuestro "palé" (el lote)
        const batch = writeBatch(db);

        for (const p of pedidosValidos) {
          const pedidoLimpio = {
            ...p,
            importe: p.importe
              ? parseFloat(String(p.importe).replace(",", ".")).toFixed(2) +
                " €"
              : "0.00 €",
          };

          // 2. Preparamos el espacio en la estantería (referencia del documento)
          const nuevoDocRef = doc(collection(db, "pedidos"));

          // 3. Ponemos la caja en el palé (añadimos al lote)
          batch.set(nuevoDocRef, pedidoLimpio);
        }

        // 4. Hacemos un único viaje para guardar todo de golpe
        await batch.commit();
      } catch (error) {
        // 5. ¡Este es el "plan de rescate" que nos faltaba!
        console.error("Error al guardar en lote:", error);
        alert("Hubo un error al guardar los pedidos en la nube.");
      }
    } // <--- ¡AQUÍ ESTÁ LA CIRUGÍA! Esta llave cierra el "if (pedidosValidos.length > 0)"

    setMostrarModalNuevo(false);
    setNuevosPedidos([pedidoVacio]);
  };

  const eliminarPedido = async (idFirebase) => {
    if (
      window.confirm(
        "⚠️ ¿Estás seguro de que quieres borrar este pedido por completo en la nube?"
      )
    ) {
      try {
        // 🚀 NUEVO: Hacemos una copia de seguridad ANTES de borrar
        const pedidoABorrar = listaPedidos.find((p) => p.id === idFirebase);
        if (pedidoABorrar) {
          registrarDeshacer("BORRAR", [
            { id: idFirebase, data: { ...pedidoABorrar } },
          ]);
        }

        // Borramos de Firebase
        await deleteDoc(doc(db, "pedidos", idFirebase));
        setFilaEditando(null);

        // Protocolo de reseteo visual
        if (pedidosFiltrados.length === 1) {
          limpiarTodosLosFiltros();
        }
      } catch (error) {
        console.error("Error al eliminar:", error);
      }
    }
  };

  const iniciarEdicion = (pedido) => {
    setFilaEditando(pedido.id);
    setTempPedido({ ...pedido });
  };

  const guardarEdicion = async (idFirebase) => {
    const pedidoGuardar = { ...tempPedido };
    if (pedidoGuardar.importe && !String(pedidoGuardar.importe).includes("€")) {
      pedidoGuardar.importe =
        parseFloat(String(pedidoGuardar.importe).replace(",", ".")).toFixed(2) +
        " €";
    }

    try {
      delete pedidoGuardar.id;
      await updateDoc(doc(db, "pedidos", idFirebase), pedidoGuardar);
      setFilaEditando(null);
    } catch (error) {
      console.error("Error al actualizar:", error);
    }
  };

  const marcarCasilla = (idFirebase) => {
    if (seleccionados.includes(idFirebase))
      setSeleccionados(seleccionados.filter((id) => id !== idFirebase));
    else setSeleccionados([...seleccionados, idFirebase]);
  };
  // --- NUEVA LÓGICA: SELECCIONAR TODOS LOS VISIBLES ---
  const manejarSeleccionarTodos = () => {
    // Si la cantidad de seleccionados es igual a la cantidad de pedidos que vemos, significa que ya están todos marcados.
    if (
      seleccionados.length === pedidosFiltrados.length &&
      pedidosFiltrados.length > 0
    ) {
      setSeleccionados([]); // Vaciamos la selección
    } else {
      // Si no, cogemos la lista de lo que se ve en pantalla y guardamos todos sus IDs
      setSeleccionados(pedidosFiltrados.map((pedido) => pedido.id));
    }
  };

  const aplicarLote = async () => {
    if (seleccionados.length === 0) return;
    try {
      for (const idFirebase of seleccionados) {
        await updateDoc(doc(db, "pedidos", idFirebase), {
          ot: loteOt || "-",
          fecha_recepcion: loteFecha || "-",
        });
      }

      // 🚀 ¡NUEVA LÓGICA!: Si la cantidad de artículos procesados es IGUAL a la cantidad de artículos que estábamos viendo...
      if (seleccionados.length === pedidosFiltrados.length) {
        limpiarTodosLosFiltros();
      }

      setSeleccionados([]);
      setLoteOt("");
    } catch (error) {
      console.error("Error al aplicar lote:", error);
    }
  };
  const eliminarLote = async () => {
    if (seleccionados.length === 0) return;

    if (
      window.confirm(
        `⚠️ Vas a eliminar DEFINITIVAMENTE ${seleccionados.length} pedidos de la nube. ¿Estás totalmente seguro?`
      )
    ) {
      try {
        // 🚀 NUEVO: Hacemos copia de seguridad de TODOS los seleccionados
        const pedidosABorrar = listaPedidos.filter((p) =>
          seleccionados.includes(p.id)
        );
        const documentosPrevios = pedidosABorrar.map((p) => ({
          id: p.id,
          data: { ...p },
        }));
        registrarDeshacer("BORRAR", documentosPrevios);

        const batch = writeBatch(db);
        for (const idFirebase of seleccionados) {
          const docRef = doc(db, "pedidos", idFirebase);
          batch.delete(docRef);
        }
        await batch.commit();

        if (seleccionados.length === pedidosFiltrados.length) {
          limpiarTodosLosFiltros();
        }
        setSeleccionados([]);
      } catch (error) {
        console.error("Error al eliminar por lote:", error);
        alert("Hubo un error al borrar los pedidos.");
      }
    }
  };

  const procesarImportacion = async () => {
    if (!textoImportacion.trim()) return;
    const lineas = textoImportacion.split("\n");
    const nuevosPedidosImportar = [];

    lineas.forEach((linea) => {
      // 1. Descartamos líneas que estén completamente en blanco
      if (!linea || linea.trim() === "") return;

      // 2. Detectamos automáticamente el separador:
      // Excel/Sheets usa tabuladores (\t), pero los archivos CSV suelen usar punto y coma (;)
      const separador = linea.includes("\t") ? "\t" : ";";

      // 3. Cortamos la línea respetando los huecos vacíos
      const col = linea.split(separador);

      // 4. "Rellenamos el pastillero": Forzamos a que siempre haya al menos 13 huecos
      // Si Excel no copió las últimas columnas vacías, el programa las añade para que nada se mueva
      while (col.length < 13) {
        col.push("");
      }
      if (col.length >= 5) {
        nuevosPedidosImportar.push({
          dias: col[0]?.trim() || "0",
          fecha: parsearFechaExcel(col[1]?.trim() || "-"),
          almacen: col[2]?.trim() || "-",
          gc: col[3]?.trim() || "",
          articulo: col[4]?.trim() || "",
          unidades: col[5]?.trim() || "0",
          tipo_articulo: col[6]?.trim() || "-",
          observaciones: col[7]?.trim() || "",
          n_pedido: col[8]?.trim() || "-",
          importe: col[9]?.trim() || "0.00 €",
          ot: col[10]?.trim() || "-",
          fecha_recepcion: parsearFechaExcel(col[11]?.trim() || "-"),
          coste_unitario: col[12]?.trim() || "0.00 €",
        });
      }
    });

    if (nuevosPedidosImportar.length > 0) {
      try {
        for (const ped of nuevosPedidosImportar) {
          await addDoc(collection(db, "pedidos"), ped);
        }
        alert(
          `¡Éxito! Se han subido ${nuevosPedidosImportar.length} pedidos a la nube.`
        );
      } catch (error) {
        console.error("Error importando a Firebase:", error);
      }
    }
    setMostrarModalImportar(false);
    setTextoImportacion("");
  };

  // ==========================================
  // FUNCIONES AUXILIARES Y RENDERIZADO
  // ==========================================
  const recalcularCoste = (importeStr, unidadesStr) => {
    const importe = parseFloat(String(importeStr).replace(",", ".")) || 0;
    const unidades = parseInt(unidadesStr) || 0;
    if (unidades > 0 && importe > 0)
      return (importe / unidades).toFixed(3) + " €";
    return "0.00 €";
  };

  const mostrarFecha = (fechaStr) => {
    if (!fechaStr || fechaStr === "-" || fechaStr === "nan") return "-";
    if (fechaStr.includes("-") && fechaStr.split("-")[0].length === 4) {
      const [año, mes, dia] = fechaStr.split("-");
      return `${dia}/${mes}/${año}`;
    }
    return fechaStr;
  };

  const parsearFechaExcel = (fechaStr) => {
    if (!fechaStr || fechaStr === "-" || fechaStr === "nan") return "-";
    if (fechaStr.includes("/")) {
      const [dia, mes, año] = fechaStr.split("/");
      const añoCompleto = año.length === 2 ? `20${año}` : año;
      return `${añoCompleto}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
    }
    return fechaStr;
  };

  const procesarEscaneo = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const gcEscaneado = inputEscaner.trim().toUpperCase();
      if (!gcEscaneado) return;

      const articuloEncontrado = articulos.find(
        (a) => a.gc && a.gc.toUpperCase() === gcEscaneado
      );

      if (articuloEncontrado) {
        const indiceExistente = nuevosPedidos.findIndex(
          (p) => p.gc && p.gc.toUpperCase() === gcEscaneado
        );
        const copiaPedidos = [...nuevosPedidos];

        if (indiceExistente >= 0) {
          const unidadesActuales =
            parseInt(copiaPedidos[indiceExistente].unidades) || 0;
          copiaPedidos[indiceExistente].unidades = unidadesActuales + 1;
          copiaPedidos[indiceExistente].coste_unitario = recalcularCoste(
            copiaPedidos[indiceExistente].importe,
            copiaPedidos[indiceExistente].unidades
          );
        } else {
          const ultimaFila = nuevosPedidos[nuevosPedidos.length - 1];
          const nuevaFila = {
            ...pedidoVacio,
            fecha: ultimaFila ? ultimaFila.fecha : fechaHoy,
            almacen:
              articuloEncontrado.almacen ||
              (ultimaFila ? ultimaFila.almacen : ""),
            n_pedido: ultimaFila ? ultimaFila.n_pedido : "",
            gc: articuloEncontrado.gc,
            articulo:
              articuloEncontrado.nombre_comun ||
              articuloEncontrado.nombre_siglo,
            tipo_articulo: articuloEncontrado.tipo_articulo || "",
            unidades: 1,
          };
          if (nuevosPedidos.length === 1 && nuevosPedidos[0].gc === "") {
            copiaPedidos[0] = nuevaFila;
          } else {
            copiaPedidos.push(nuevaFila);
          }
        }
        setNuevosPedidos(copiaPedidos);
      } else {
        alert(`⚠️ El código ${gcEscaneado} no está en tu catálogo.`);
      }
      setInputEscaner("");
    }
  };

  const toggleSeleccionArticulo = (articulo) => {
    if (articulosSeleccionados.some((a) => a.gc === articulo.gc)) {
      setArticulosSeleccionados(
        articulosSeleccionados.filter((a) => a.gc !== articulo.gc)
      );
    } else {
      setArticulosSeleccionados([...articulosSeleccionados, articulo]);
    }
  };

  const confirmarSeleccionCatalogo = () => {
    const ultimaFila = nuevosPedidos[nuevosPedidos.length - 1];
    const baseFecha = ultimaFila ? ultimaFila.fecha : fechaHoy;
    const baseAlmacen = ultimaFila ? ultimaFila.almacen : "";
    const baseNPedido = ultimaFila ? ultimaFila.n_pedido : "";

    const nuevasFilas = articulosSeleccionados.map((art) => ({
      ...pedidoVacio,
      fecha: baseFecha,
      almacen: art.almacen || baseAlmacen,
      gc: art.gc,
      articulo: art.nombre_comun || art.nombre_siglo,
      tipo_articulo: art.tipo_articulo || "",
      n_pedido: baseNPedido,
    }));

    const filasActuales =
      nuevosPedidos.length === 1 && nuevosPedidos[0].gc === ""
        ? []
        : nuevosPedidos;
    setNuevosPedidos([...filasActuales, ...nuevasFilas]);
    setMostrarSelectorCatalogo(false);
    setArticulosSeleccionados([]);
    setBusquedaMiniCatalogo("");
  };

  const catalogoFiltrado = articulos.filter((art) => {
    const tienePermiso =
      usuarioActual.rol === "admin" ||
      usuarioActual.almacenes.some(
        (almacenPermitido) =>
          art.almacen && art.almacen.includes(almacenPermitido)
      );
    if (!tienePermiso) return false;

    const busq = busquedaMiniCatalogo.toLowerCase();
    const todasLasColumnas = [
      "almacen",
      "gc",
      "nombre_siglo",
      "nombre_comun",
      "tipo_articulo",
      "ubicacion",
      "referencia",
      "observaciones",
      "incidencias",
    ];

    return columnaMiniCatalogo === "todas"
      ? todasLasColumnas.some((col) =>
          String(art[col] || "")
            .toLowerCase()
            .includes(busq)
        )
      : String(art[columnaMiniCatalogo] || "")
          .toLowerCase()
          .includes(busq);
  });

  const actualizarFilaNuevo = (index, campo, valor) => {
    const copia = [...nuevosPedidos];
    copia[index][campo] = valor;
    setNuevosPedidos(copia);
  };

  const manejarCambioGCNuevo = (index, valorGc) => {
    const art = articulos.find(
      (a) => a.gc.toLowerCase() === valorGc.toLowerCase()
    );
    const copia = [...nuevosPedidos];
    copia[index].gc = valorGc;
    if (art) {
      copia[index].articulo = art.nombre_comun || copia[index].articulo;
      copia[index].almacen = art.almacen || copia[index].almacen;
      copia[index].tipo_articulo =
        art.tipo_articulo || copia[index].tipo_articulo;
    }
    setNuevosPedidos(copia);
  };

  const manejarCambioUnidadesNuevo = (index, valor) => {
    const copia = [...nuevosPedidos];
    copia[index].unidades = valor;
    copia[index].coste_unitario = recalcularCoste(copia[index].importe, valor);
    setNuevosPedidos(copia);
  };

  const manejarCambioImporteNuevo = (index, valor) => {
    const copia = [...nuevosPedidos];
    copia[index].importe = valor;
    copia[index].coste_unitario = recalcularCoste(valor, copia[index].unidades);
    setNuevosPedidos(copia);
  };

  const agregarFilaPedido = () => {
    const ultimaFila = nuevosPedidos[nuevosPedidos.length - 1];
    setNuevosPedidos([
      ...nuevosPedidos,
      {
        ...pedidoVacio,
        fecha: ultimaFila.fecha,
        almacen: ultimaFila.almacen,
        n_pedido: ultimaFila.n_pedido,
      },
    ]);
  };

  const eliminarFilaPedido = (index) => {
    if (nuevosPedidos.length > 1) {
      setNuevosPedidos(nuevosPedidos.filter((_, i) => i !== index));
    }
  };

  const manejarCambioUnidadesEdicion = (e) => {
    const nuevasUnidades = e.target.value;
    const nuevoCoste = recalcularCoste(tempPedido.importe, nuevasUnidades);
    setTempPedido({
      ...tempPedido,
      unidades: nuevasUnidades,
      coste_unitario: nuevoCoste,
    });
  };

  const manejarCambioImporteEdicion = (e) => {
    const nuevoImporte = e.target.value;
    const nuevoCoste = recalcularCoste(nuevoImporte, tempPedido.unidades);
    setTempPedido({
      ...tempPedido,
      importe: nuevoImporte,
      coste_unitario: nuevoCoste,
    });
  };

  const estiloInputTabla = {
    width: "100%",
    padding: "8px",
    boxSizing: "border-box",
    border: "1px solid #ccc",
    borderRadius: "4px",
  };

  const renderCabeceraDinamica = (
    tituloPantalla,
    campoBaseDatos,
    ancho = "auto"
  ) => {
    // 1. Obtenemos valores únicos de la base de datos
    const valoresUnicos = [
      ...new Set(
        listaPedidos
          .map((p) => String(p[campoBaseDatos] || ""))
          .filter((v) => v.trim() !== "" && v !== "-" && v !== "nan")
      ),
    ].sort();

    // 2. Miramos si hay algún filtro OFICIAL guardado para poner el botón verde
    const filtroActivo = (filtrosColumna[campoBaseDatos] || []).length > 0;

    // 3. Filtramos las opciones según el buscador interno
    const opcionesFiltradas = valoresUnicos.filter((val) =>
      val.toLowerCase().includes(busquedaMenu.toLowerCase())
    );

    // 4. LÓGICA TEMPORAL (Escribimos en el BORRADOR, no en la tabla)
    const toggleSeleccion = (val) => {
      if (seleccionesTemporales.includes(val)) {
        setSeleccionesTemporales(
          seleccionesTemporales.filter((v) => v !== val)
        ); // Quitar del borrador
      } else {
        setSeleccionesTemporales([...seleccionesTemporales, val]); // Añadir al borrador
      }
    };

    return (
      <th
        style={{
          padding: "8px",
          border: "1px solid #ddd",
          position: "relative",
          width: ancho,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{tituloPantalla}</span>
          <button
            onClick={() => {
              if (menuColumnaAbierto === campoBaseDatos) {
                setMenuColumnaAbierto(null); // Cerrar si ya estaba abierto
              } else {
                setMenuColumnaAbierto(campoBaseDatos); // Abrir menú
                setBusquedaMenu(""); // Limpiar buscador
                // AL ABRIR: Copiamos el filtro oficial actual al borrador para empezar a trabajar
                setSeleccionesTemporales(filtrosColumna[campoBaseDatos] || []);
              }
            }}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "12px",
              color: filtroActivo ? "#28a745" : "#fff",
            }}
            title={`Filtrar ${tituloPantalla}`}
          >
            ▼
          </button>
        </div>

        {menuColumnaAbierto === campoBaseDatos && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              backgroundColor: "white",
              border: "1px solid #ccc",
              borderRadius: "4px",
              padding: "12px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
              zIndex: 100,
              minWidth: "220px",
              color: "#333",
              fontWeight: "normal",
            }}
          >
            <div
              style={{
                fontWeight: "bold",
                marginBottom: "8px",
                fontSize: "13px",
              }}
            >
              Filtrar {tituloPantalla}
            </div>

            <input
              type="text"
              placeholder="🔍 Buscar valor..."
              value={busquedaMenu}
              onChange={(e) => setBusquedaMenu(e.target.value)}
              style={{
                width: "100%",
                padding: "6px",
                marginBottom: "10px",
                boxSizing: "border-box",
                fontSize: "12px",
                borderRadius: "4px",
                border: "1px solid #ccc",
              }}
            />

            <div
              style={{
                display: "flex",
                gap: "10px",
                marginBottom: "10px",
                fontSize: "11px",
              }}
            >
              {/* Estos botones ahora actúan sobre el BORRADOR */}
              <span
                onClick={() => setSeleccionesTemporales(opcionesFiltradas)}
                style={{
                  color: "#0056b3",
                  cursor: "pointer",
                  textDecoration: "underline",
                  fontWeight: "bold",
                }}
              >
                Seleccionar todo
              </span>
              <span
                onClick={() => setSeleccionesTemporales([])}
                style={{
                  color: "#dc3545",
                  cursor: "pointer",
                  textDecoration: "underline",
                  fontWeight: "bold",
                }}
              >
                Borrar todo
              </span>
            </div>

            <div
              style={{
                maxHeight: "200px",
                overflowY: "auto",
                borderTop: "1px solid #eee",
                borderBottom: "1px solid #eee",
                padding: "8px 0",
              }}
            >
              {opcionesFiltradas.length === 0 ? (
                <div
                  style={{
                    fontSize: "12px",
                    color: "#999",
                    fontStyle: "italic",
                    padding: "4px",
                  }}
                >
                  No hay coincidencias
                </div>
              ) : (
                opcionesFiltradas.map((val, i) => (
                  <label
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      padding: "4px 0",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    <input
                      type="checkbox"
                      // La casilla se marca si está en el BORRADOR
                      checked={seleccionesTemporales.includes(val)}
                      onChange={() => toggleSeleccion(val)}
                      style={{
                        marginRight: "8px",
                        marginTop: "2px",
                        cursor: "pointer",
                      }}
                    />
                    <span style={{ flex: 1, wordBreak: "break-word" }}>
                      {val}
                    </span>
                  </label>
                ))
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "10px",
              }}
            >
              <button
                onClick={() => {
                  // ¡EL SELLO OFICIAL! Pasamos el borrador al filtro principal y cerramos el menú
                  setFiltrosColumna({
                    ...filtrosColumna,
                    [campoBaseDatos]: seleccionesTemporales,
                  });
                  setMenuColumnaAbierto(null);
                }}
                style={{
                  padding: "6px 15px",
                  backgroundColor: "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              >
                Aceptar
              </button>
            </div>
          </div>
        )}
      </th>
    );
  };

  return (
    <div
      style={{
        backgroundColor: "white",
        padding: "15px",
        borderRadius: "8px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "15px",
        }}
      >
        <h2 style={{ color: "#333", margin: 0 }}>Registro de Pedidos</h2>
        <div style={{ display: "flex", gap: "10px" }}>
          {historialDeshacer.length > 0 && (
            <button
              onClick={ejecutarDeshacer}
              style={{
                padding: "10px 20px",
                backgroundColor: "#ffc107",
                color: "#333",
                border: "none",
                borderRadius: "5px",
                fontWeight: "bold",
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
              title="Deshacer la última acción"
            >
              ↩️ Deshacer ({historialDeshacer.length})
            </button>
          )}
          <button
            onClick={() => setMostrarModalNuevo(true)}
            style={{
              padding: "10px 20px",
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "5px",
              fontWeight: "bold",
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            + Nuevo Pedido
          </button>
          <button
            onClick={() => setMostrarModalImportar(true)}
            style={{
              padding: "10px 20px",
              backgroundColor: "#17a2b8",
              color: "white",
              border: "none",
              borderRadius: "5px",
              fontWeight: "bold",
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            📥 Importar de Excel
          </button>
        </div>
      </div>

      <input
        type="text"
        placeholder="🔍 Buscar por Nº, GC, OT o artículo..."
        value={busquedaHistorial}
        onChange={(e) => setBusquedaHistorial(e.target.value)}
        style={{
          width: "100%",
          padding: "10px",
          marginBottom: "15px",
          borderRadius: "4px",
          border: "1px solid #ccc",
          fontSize: "14px",
          boxSizing: "border-box",
          backgroundColor: "#fdfdfd",
        }}
      />

      {seleccionados.length > 0 && (
        <div
          style={{
            backgroundColor: "#e2e6ea",
            padding: "15px",
            borderRadius: "8px",
            marginBottom: "15px",
            display: "flex",
            gap: "15px",
            alignItems: "center",
            border: "1px solid #ced4da",
          }}
        >
          <span style={{ fontWeight: "bold", color: "#333" }}>
            {seleccionados.length} seleccionados
          </span>
          <input
            type="text"
            placeholder="OT Común"
            value={loteOt}
            onChange={(e) => setLoteOt(e.target.value)}
            style={{
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              flex: 1,
            }}
          />
          <input
            type="date"
            value={loteFecha}
            onChange={(e) => setLoteFecha(e.target.value)}
            style={{
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #ccc",
            }}
          />
          <button
            onClick={aplicarLote}
            style={{
              padding: "8px 20px",
              backgroundColor: "#0056b3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Aplicar a todos en la Nube
          </button>
          <button
            onClick={eliminarLote}
            style={{
              padding: "8px 20px",
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
            title="Borrar todos los pedidos seleccionados"
          >
            🗑️ Borrar Seleccionados
          </button>
          <button
            onClick={() => setSeleccionados([])}
            style={{
              padding: "8px 15px",
              backgroundColor: "white",
              color: "#333",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            minWidth: "1200px",
            borderCollapse: "collapse",
            fontSize: "12px",
            textAlign: "left",
            tableLayout: "auto",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "#0056b3", color: "white" }}>
              {/* CASILLA MAESTRA DE SELECCIÓN */}
              <th
                style={{
                  padding: "8px",
                  border: "1px solid #ddd",
                  textAlign: "center",
                  width: "3%",
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    pedidosFiltrados.length > 0 &&
                    seleccionados.length === pedidosFiltrados.length
                  }
                  onChange={manejarSeleccionarTodos}
                  style={{ cursor: "pointer", transform: "scale(1.2)" }}
                  title="Seleccionar todos los pedidos visibles"
                />
              </th>

              {/* 1. DÍAS */}
              {renderCabeceraDinamica("Días", "dias", "5%")}

              {/* 2. FECHA (Mantenemos tu cabecera especial con el calendario) */}
              <th
                style={{
                  padding: "8px",
                  border: "1px solid #ddd",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>Fecha</span>
                  <button
                    onClick={() => setMostrarFiltroFecha(!mostrarFiltroFecha)}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "12px",
                      color:
                        filtroFechaExacta || filtroMes || filtroAnio
                          ? "#28a745"
                          : "#fff",
                    }}
                    title="Filtrar por fecha"
                  >
                    ▼
                  </button>
                </div>
                {mostrarFiltroFecha && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      backgroundColor: "white",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      padding: "15px",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
                      zIndex: 100,
                      minWidth: "200px",
                      color: "#333",
                      fontWeight: "normal",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <label
                        style={{
                          fontSize: "11px",
                          fontWeight: "bold",
                          marginBottom: "2px",
                        }}
                      >
                        Día exacto:
                      </label>
                      <input
                        type="date"
                        value={filtroFechaExacta}
                        onChange={(e) => {
                          setFiltroFechaExacta(e.target.value);
                          setFiltroMes("");
                          setFiltroAnio("");
                        }}
                        style={{
                          padding: "6px",
                          fontSize: "12px",
                          border: "1px solid #ccc",
                          borderRadius: "3px",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <label
                        style={{
                          fontSize: "11px",
                          fontWeight: "bold",
                          marginBottom: "2px",
                        }}
                      >
                        Mes y Año:
                      </label>
                      <input
                        type="month"
                        value={filtroMes}
                        onChange={(e) => {
                          setFiltroMes(e.target.value);
                          setFiltroFechaExacta("");
                          setFiltroAnio("");
                        }}
                        style={{
                          padding: "6px",
                          fontSize: "12px",
                          border: "1px solid #ccc",
                          borderRadius: "3px",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <label
                        style={{
                          fontSize: "11px",
                          fontWeight: "bold",
                          marginBottom: "2px",
                        }}
                      >
                        Solo Año:
                      </label>
                      <input
                        type="number"
                        placeholder="Ej. 2024"
                        value={filtroAnio}
                        onChange={(e) => {
                          setFiltroAnio(e.target.value);
                          setFiltroFechaExacta("");
                          setFiltroMes("");
                        }}
                        style={{
                          padding: "6px",
                          fontSize: "12px",
                          border: "1px solid #ccc",
                          borderRadius: "3px",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: "10px",
                      }}
                    >
                      <button
                        onClick={() => {
                          setFiltroFechaExacta("");
                          setFiltroMes("");
                          setFiltroAnio("");
                        }}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#dc3545",
                          color: "white",
                          border: "none",
                          borderRadius: "3px",
                          cursor: "pointer",
                          fontSize: "11px",
                          fontWeight: "bold",
                        }}
                      >
                        Limpiar
                      </button>
                      <button
                        onClick={() => setMostrarFiltroFecha(false)}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#0056b3",
                          color: "white",
                          border: "none",
                          borderRadius: "3px",
                          cursor: "pointer",
                          fontSize: "11px",
                          fontWeight: "bold",
                        }}
                      >
                        OK
                      </button>
                    </div>
                  </div>
                )}
              </th>

              {/* RESTO DE LAS 13 COLUMNAS EN ORDEN */}
              {renderCabeceraDinamica("Almacén", "almacen")}
              {renderCabeceraDinamica("GCs", "gc")}
              {renderCabeceraDinamica("Artículo solicitado", "articulo", "20%")}
              {renderCabeceraDinamica("Uds.", "unidades")}
              {renderCabeceraDinamica("Tipo", "tipo_articulo")}
              {renderCabeceraDinamica("Observaciones", "observaciones")}
              {renderCabeceraDinamica("Nº Pedido", "n_pedido")}
              {renderCabeceraDinamica("Importe", "importe")}
              {renderCabeceraDinamica("OT", "ot", "8%")}
              {renderCabeceraDinamica("Recepción", "fecha_recepcion", "10%")}
              {renderCabeceraDinamica("Coste/ud", "coste_unitario")}

              {/* ACCIONES (Mantenemos tu menú especial) */}
              <th
                style={{
                  padding: "8px",
                  border: "1px solid #ddd",
                  textAlign: "center",
                  width: "10%",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>Acciones</span>
                  <button
                    onClick={() => setMostrarFiltroEstado(!mostrarFiltroEstado)}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "12px",
                      color: filtroEstado ? "#28a745" : "#fff",
                    }}
                    title="Filtrar por Estado"
                  >
                    ▼
                  </button>
                </div>
                {mostrarFiltroEstado && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "100%",
                      backgroundColor: "white",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      padding: "10px",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
                      zIndex: 100,
                      minWidth: "130px",
                      color: "#333",
                      fontWeight: "normal",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: "bold",
                        marginBottom: "8px",
                        fontSize: "12px",
                        borderBottom: "1px solid #eee",
                        paddingBottom: "4px",
                        textAlign: "left",
                      }}
                    >
                      Estado del Pedido
                    </div>
                    <div
                      onClick={() => {
                        setFiltroEstado("");
                        setMostrarFiltroEstado(false);
                      }}
                      style={{
                        padding: "8px",
                        cursor: "pointer",
                        backgroundColor: !filtroEstado
                          ? "#e6f4ea"
                          : "transparent",
                        fontSize: "12px",
                        borderRadius: "3px",
                        color: "#d32f2f",
                        fontWeight: "bold",
                        textAlign: "left",
                      }}
                    >
                      🔄 Todos
                    </div>
                    <div
                      onClick={() => {
                        setFiltroEstado("Pendiente");
                        setMostrarFiltroEstado(false);
                      }}
                      style={{
                        padding: "8px",
                        cursor: "pointer",
                        backgroundColor:
                          filtroEstado === "Pendiente"
                            ? "#e6f4ea"
                            : "transparent",
                        fontSize: "12px",
                        borderRadius: "3px",
                        textAlign: "left",
                      }}
                    >
                      ⏳ Pendientes
                    </div>
                    <div
                      onClick={() => {
                        setFiltroEstado("Completado");
                        setMostrarFiltroEstado(false);
                      }}
                      style={{
                        padding: "8px",
                        cursor: "pointer",
                        backgroundColor:
                          filtroEstado === "Completado"
                            ? "#e6f4ea"
                            : "transparent",
                        fontSize: "12px",
                        borderRadius: "3px",
                        textAlign: "left",
                      }}
                    >
                      ✅ Completados
                    </div>
                  </div>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {pedidosFiltrados.map((pedido, index) => {
              const estaRecibido =
                pedido.fecha_recepcion &&
                pedido.fecha_recepcion !== "nan" &&
                pedido.fecha_recepcion !== "-" &&
                pedido.fecha_recepcion !== "";
              const esFilaEditada = filaEditando === pedido.id;
              const estaSeleccionado = seleccionados.includes(pedido.id);

              return (
                <tr
                  key={pedido.id || index}
                  // ❌ AQUÍ QUITAMOS EL onMouseEnter y onMouseLeave
                  style={{
                    backgroundColor: estaSeleccionado
                      ? "#d0e4ff"
                      : esFilaEditada
                      ? "#fff8b0"
                      : estaRecibido
                      ? "#e2e6ea"
                      : index % 2 === 0
                      ? "#f9f9f9"
                      : "white",
                    borderBottom: "1px solid #ddd",
                    color:
                      estaRecibido && !esFilaEditada && !estaSeleccionado
                        ? "#6c757d"
                        : "#000",
                  }}
                >
                  <td
                    style={{
                      padding: "6px",
                      border: "1px solid #ddd",
                      textAlign: "center",
                    }}
                  >
                    {!esFilaEditada && (
                      <input
                        type="checkbox"
                        checked={estaSeleccionado}
                        onChange={() => marcarCasilla(pedido.id)}
                        style={{ cursor: "pointer" }}
                      />
                    )}
                  </td>

                  {/* 1. DÍAS */}
                  <td
                    style={{
                      padding: "6px",
                      border: "1px solid #ddd",
                      textAlign: "center",
                      fontWeight: "bold",
                      color:
                        calcularDias(pedido.fecha, pedido.fecha_recepcion) > 7
                          ? "#dc3545"
                          : "inherit",
                    }}
                  >
                    {calcularDias(pedido.fecha, pedido.fecha_recepcion)}
                  </td>

                  {/* 2. FECHA */}
                  <td
                    style={{
                      padding: "6px",
                      border: "1px solid #ddd",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {esFilaEditada ? (
                      <input
                        type="date"
                        value={tempPedido.fecha}
                        onChange={(e) =>
                          setTempPedido({
                            ...tempPedido,
                            fecha: e.target.value,
                          })
                        }
                        style={estiloInputTabla}
                      />
                    ) : (
                      mostrarFecha(pedido.fecha)
                    )}
                  </td>

                  {/* 3. ALMACÉN */}
                  <td
                    style={{ padding: "6px", border: "1px solid #ddd" }}
                    translate="no"
                  >
                    {esFilaEditada ? (
                      <select
                        value={tempPedido.almacen}
                        onChange={(e) =>
                          setTempPedido({
                            ...tempPedido,
                            almacen: e.target.value,
                          })
                        }
                        style={estiloInputTabla}
                      >
                        <option value="">--</option>
                        {listaAlmacenes.map((alm, i) => (
                          <option key={i} value={alm}>
                            {alm}
                          </option>
                        ))}
                      </select>
                    ) : (
                      pedido.almacen
                    )}
                  </td>

                  {/* 4. GCs */}
                  <td
                    style={{
                      padding: "6px",
                      border: "1px solid #ddd",
                      fontWeight: "bold",
                    }}
                  >
                    {esFilaEditada ? (
                      <input
                        type="text"
                        value={tempPedido.gc}
                        onChange={(e) =>
                          setTempPedido({ ...tempPedido, gc: e.target.value })
                        }
                        style={estiloInputTabla}
                      />
                    ) : (
                      pedido.gc
                    )}
                  </td>

                  {/* 5. ARTÍCULO */}
                  <td style={{ padding: "6px", border: "1px solid #ddd" }}>
                    {esFilaEditada ? (
                      <input
                        type="text"
                        value={tempPedido.articulo}
                        onChange={(e) =>
                          setTempPedido({
                            ...tempPedido,
                            articulo: e.target.value,
                          })
                        }
                        style={estiloInputTabla}
                      />
                    ) : (
                      // Buscamos el GC en el catálogo para mostrar siempre el Nombre Común actualizado
                      articulos.find((a) => a.gc === pedido.gc)?.nombre_comun ||
                      pedido.articulo
                    )}
                  </td>

                  {/* 6. UDS */}
                  <td
                    style={{
                      padding: "6px",
                      border: "1px solid #ddd",
                      textAlign: "center",
                      fontWeight: "bold",
                    }}
                  >
                    {esFilaEditada ? (
                      <input
                        type="number"
                        min="1"
                        value={tempPedido.unidades}
                        onChange={manejarCambioUnidadesEdicion}
                        style={estiloInputTabla}
                      />
                    ) : (
                      pedido.unidades
                    )}
                  </td>

                  {/* 7. TIPO */}
                  <td style={{ padding: "6px", border: "1px solid #ddd" }}>
                    {esFilaEditada ? (
                      <select
                        value={tempPedido.tipo_articulo || ""}
                        onChange={(e) =>
                          setTempPedido({
                            ...tempPedido,
                            tipo_articulo: e.target.value,
                          })
                        }
                        style={estiloInputTabla}
                      >
                        <option value="">--</option>
                        <option value="ALMACENABLE">ALMACENABLE</option>
                        <option value="TRÁNSITO">TRÁNSITO</option>
                      </select>
                    ) : (
                      pedido.tipo_articulo
                    )}
                  </td>

                  {/* 8. OBSERVACIONES */}
                  <td style={{ padding: "6px", border: "1px solid #ddd" }}>
                    {esFilaEditada ? (
                      <input
                        type="text"
                        value={tempPedido.observaciones || ""}
                        onChange={(e) =>
                          setTempPedido({
                            ...tempPedido,
                            observaciones: e.target.value,
                          })
                        }
                        style={estiloInputTabla}
                      />
                    ) : (
                      pedido.observaciones
                    )}
                  </td>

                  {/* 9. Nº PEDIDO */}
                  <td style={{ padding: "6px", border: "1px solid #ddd" }}>
                    {esFilaEditada ? (
                      <input
                        type="text"
                        value={tempPedido.n_pedido}
                        onChange={(e) =>
                          setTempPedido({
                            ...tempPedido,
                            n_pedido: e.target.value,
                          })
                        }
                        style={estiloInputTabla}
                      />
                    ) : (
                      pedido.n_pedido
                    )}
                  </td>

                  {/* 10. IMPORTE */}
                  <td
                    style={{
                      padding: "6px",
                      border: "1px solid #ddd",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {esFilaEditada ? (
                      <input
                        type="text"
                        value={String(tempPedido.importe || "").replace(
                          " €",
                          ""
                        )}
                        onChange={manejarCambioImporteEdicion}
                        style={estiloInputTabla}
                      />
                    ) : (
                      pedido.importe
                    )}
                  </td>

                  {/* 11. OT */}
                  <td style={{ padding: "6px", border: "1px solid #ddd" }}>
                    {esFilaEditada ? (
                      <input
                        type="text"
                        value={tempPedido.ot}
                        onChange={(e) =>
                          setTempPedido({ ...tempPedido, ot: e.target.value })
                        }
                        style={estiloInputTabla}
                      />
                    ) : (
                      <span style={{ fontWeight: "bold", color: "#d32f2f" }}>
                        {pedido.ot !== "nan" ? pedido.ot : "-"}
                      </span>
                    )}
                  </td>

                  {/* 12. RECEPCIÓN */}
                  <td style={{ padding: "6px", border: "1px solid #ddd" }}>
                    {esFilaEditada ? (
                      <input
                        type="date"
                        value={tempPedido.fecha_recepcion}
                        onChange={(e) =>
                          setTempPedido({
                            ...tempPedido,
                            fecha_recepcion: e.target.value,
                          })
                        }
                        style={estiloInputTabla}
                      />
                    ) : (
                      mostrarFecha(pedido.fecha_recepcion)
                    )}
                  </td>

                  {/* 13. COSTE/UD */}
                  <td
                    style={{
                      padding: "6px",
                      border: "1px solid #ddd",
                      whiteSpace: "nowrap",
                      fontWeight: "bold",
                      color: "#137333",
                    }}
                  >
                    {esFilaEditada ? (
                      <input
                        type="text"
                        value={tempPedido.coste_unitario}
                        readOnly
                        style={{
                          ...estiloInputTabla,
                          border: "none",
                          backgroundColor: "transparent",
                          color: "#137333",
                          fontWeight: "bold",
                        }}
                      />
                    ) : (
                      pedido.coste_unitario
                    )}
                  </td>
                  {/* --- INICIO DE LA COLUMNA ACCIONES --- */}
                  <td
                    style={{
                      padding: "6px",
                      border: "1px solid #ddd",
                      textAlign: "center",
                    }}
                  >
                    {esFilaEditada ? (
                      <div
                        style={{
                          display: "flex",
                          gap: "5px",
                          justifyContent: "center",
                        }}
                      >
                        <button
                          onClick={() => guardarEdicion(pedido.id)}
                          style={{
                            padding: "6px",
                            backgroundColor: "#28a745",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                          title="Guardar"
                        >
                          💾
                        </button>
                        <button
                          onClick={() => setFilaEditando(null)}
                          style={{
                            padding: "6px",
                            backgroundColor: "#6c757d",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                          title="Cancelar edición"
                        >
                          ❌
                        </button>
                        <button
                          onClick={() => eliminarPedido(pedido.id)}
                          style={{
                            padding: "6px",
                            backgroundColor: "#dc3545",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                          title="Borrar definitivamente"
                        >
                          🗑️
                        </button>
                      </div>
                    ) : !estaRecibido ? (
                      <div
                        style={{
                          display: "flex",
                          gap: "5px",
                          justifyContent: "center",
                        }}
                      >
                        <button
                          onClick={() => iniciarEdicion(pedido)}
                          style={{
                            padding: "6px 10px",
                            backgroundColor: "#ffc107",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontWeight: "bold",
                            color: "#333",
                            flex: 1,
                          }}
                        >
                          ⏳ Pendiente
                        </button>
                        <button
                          onClick={() => eliminarPedido(pedido.id)}
                          style={{
                            padding: "6px",
                            backgroundColor: "#dc3545",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                          title="Borrar Pedido"
                        >
                          🗑️
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                        }}
                      >
                        <span
                          style={{
                            color: "#28a745",
                            fontWeight: "bold",
                            fontSize: "14px",
                          }}
                        >
                          ✅ Completado
                        </span>
                        <button
                          onClick={() => iniciarEdicion(pedido)}
                          style={{
                            padding: "4px 8px",
                            backgroundColor: "#e2e6ea",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px",
                            color: "#333",
                          }}
                          title="Modificar Pedido"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => eliminarPedido(pedido.id)}
                          style={{
                            padding: "4px 8px",
                            backgroundColor: "#dc3545",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                          title="Borrar Pedido"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </td>
                  {/* --- FIN DE LA COLUMNA ACCIONES --- */}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {mostrarModalNuevo && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "8px",
              width: "95%",
              maxWidth: "1500px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "15px",
                borderBottom: "2px solid #0056b3",
                paddingBottom: "10px",
              }}
            >
              <h2 style={{ margin: 0, color: "#0056b3" }}>
                Añadir Líneas de Pedido
              </h2>
              <button
                onClick={() => setMostrarModalNuevo(false)}
                style={{
                  backgroundColor: "transparent",
                  border: "none",
                  fontSize: "20px",
                  cursor: "pointer",
                  color: "#dc3545",
                  fontWeight: "bold",
                }}
              >
                ✖
              </button>
            </div>

            <form
              onSubmit={guardarNuevosPedidos}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  backgroundColor: "#fff3cd",
                  padding: "15px",
                  borderRadius: "8px",
                  border: "2px dashed #ffe8a1",
                  marginBottom: "15px",
                  display: "flex",
                  alignItems: "center",
                  gap: "15px",
                }}
              >
                <span style={{ fontSize: "24px" }}>🔫</span>
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      fontWeight: "bold",
                      color: "#856404",
                      display: "block",
                      marginBottom: "5px",
                    }}
                  >
                    Modo Escáner Activo: Pon el cursor aquí y dispara al código
                    de barras
                  </label>
                  <input
                    type="text"
                    autoFocus
                    placeholder="Esperando lectura de GC..."
                    value={inputEscaner}
                    onChange={(e) => setInputEscaner(e.target.value)}
                    onKeyDown={procesarEscaneo}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "4px",
                      border: "2px solid #ffc107",
                      fontSize: "16px",
                      fontWeight: "bold",
                      textAlign: "center",
                      textTransform: "uppercase",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
              <div
                style={{
                  overflowY: "auto",
                  overflowX: "auto",
                  flex: 1,
                  paddingBottom: "10px",
                  width: "100%",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "12px",
                    textAlign: "left",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        backgroundColor: "#f0f2f5",
                        color: "#333",
                        position: "sticky",
                        top: 0,
                        zIndex: 1,
                      }}
                    >
                      <th
                        style={{
                          padding: "8px",
                          border: "1px solid #ccc",
                          width: "4%",
                        }}
                      >
                        Días
                      </th>
                      <th
                        style={{
                          padding: "8px",
                          border: "1px solid #ccc",
                          width: "8%",
                        }}
                      >
                        Fecha
                      </th>
                      <th
                        style={{
                          padding: "8px",
                          border: "1px solid #ccc",
                          width: "8%",
                        }}
                      >
                        Almacén
                      </th>
                      <th
                        style={{
                          padding: "8px",
                          border: "1px solid #ccc",
                          width: "7%",
                        }}
                      >
                        GC
                      </th>
                      <th
                        style={{
                          padding: "8px",
                          border: "1px solid #ccc",
                          width: "20%",
                        }}
                      >
                        Artículo
                      </th>
                      <th
                        style={{
                          padding: "8px",
                          border: "1px solid #ccc",
                          width: "5%",
                        }}
                      >
                        Uds.
                      </th>
                      <th
                        style={{
                          padding: "8px",
                          border: "1px solid #ccc",
                          width: "7%",
                        }}
                      >
                        Tipo
                      </th>
                      <th style={{ padding: "8px", border: "1px solid #ccc" }}>
                        Observaciones
                      </th>
                      <th
                        style={{
                          padding: "8px",
                          border: "1px solid #ccc",
                          width: "8%",
                        }}
                      >
                        Nº Pedido
                      </th>
                      <th
                        style={{
                          padding: "8px",
                          border: "1px solid #ccc",
                          width: "7%",
                        }}
                      >
                        Importe
                      </th>
                      <th
                        style={{
                          padding: "8px",
                          border: "1px solid #ccc",
                          width: "6%",
                        }}
                      >
                        OT
                      </th>
                      <th
                        style={{
                          padding: "8px",
                          border: "1px solid #ccc",
                          width: "8%",
                        }}
                      >
                        Recepción
                      </th>
                      <th
                        style={{
                          padding: "8px",
                          border: "1px solid #ccc",
                          width: "7%",
                          color: "#137333",
                        }}
                      >
                        Coste/ud
                      </th>
                      <th
                        style={{
                          padding: "8px",
                          border: "1px solid #ccc",
                          textAlign: "center",
                          width: "4%",
                        }}
                      >
                        🗑️
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {nuevosPedidos.map((linea, index) => (
                      <tr key={index}>
                        <td
                          style={{
                            padding: "4px",
                            border: "1px solid #ccc",
                            textAlign: "center",
                            backgroundColor: "#e2e6ea",
                            fontWeight: "bold",
                          }}
                        >
                          {calcularDias(linea.fecha, linea.fecha_recepcion)}
                        </td>
                        <td
                          style={{ padding: "4px", border: "1px solid #ccc" }}
                        >
                          <input
                            type="date"
                            value={linea.fecha}
                            onChange={(e) =>
                              actualizarFilaNuevo(
                                index,
                                "fecha",
                                e.target.value
                              )
                            }
                            required
                            style={estiloInputTabla}
                          />
                        </td>
                        <td
                          style={{ padding: "4px", border: "1px solid #ccc" }}
                        >
                          <select
                            value={linea.almacen}
                            onChange={(e) =>
                              actualizarFilaNuevo(
                                index,
                                "almacen",
                                e.target.value
                              )
                            }
                            required
                            style={estiloInputTabla}
                          >
                            <option value="">--</option>
                            {listaAlmacenes.map((alm, i) => (
                              <option key={i} value={alm}>
                                {alm}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td
                          style={{ padding: "4px", border: "1px solid #ccc" }}
                        >
                          <input
                            type="text"
                            placeholder="GC..."
                            value={linea.gc}
                            onChange={(e) =>
                              manejarCambioGCNuevo(index, e.target.value)
                            }
                            required
                            style={{
                              ...estiloInputTabla,
                              border: "2px solid #28a745",
                              fontWeight: "bold",
                            }}
                          />
                        </td>
                        <td
                          style={{ padding: "4px", border: "1px solid #ccc" }}
                        >
                          <input
                            type="text"
                            value={linea.articulo}
                            onChange={(e) =>
                              actualizarFilaNuevo(
                                index,
                                "articulo",
                                e.target.value
                              )
                            }
                            required
                            style={{
                              ...estiloInputTabla,
                              backgroundColor: "#f9f9f9",
                            }}
                          />
                        </td>
                        <td
                          style={{ padding: "4px", border: "1px solid #ccc" }}
                        >
                          <input
                            type="number"
                            min="1"
                            value={linea.unidades}
                            onChange={(e) =>
                              manejarCambioUnidadesNuevo(index, e.target.value)
                            }
                            required
                            style={{
                              ...estiloInputTabla,
                              textAlign: "center",
                              fontWeight: "bold",
                            }}
                          />
                        </td>
                        <td
                          style={{ padding: "4px", border: "1px solid #ccc" }}
                        >
                          <select
                            value={linea.tipo_articulo}
                            onChange={(e) =>
                              actualizarFilaNuevo(
                                index,
                                "tipo_articulo",
                                e.target.value
                              )
                            }
                            required
                            style={estiloInputTabla}
                          >
                            <option value="">--</option>
                            <option value="ALMACENABLE">ALMACENABLE</option>
                            <option value="TRÁNSITO">TRÁNSITO</option>
                          </select>
                        </td>
                        <td
                          style={{ padding: "4px", border: "1px solid #ccc" }}
                        >
                          <input
                            type="text"
                            value={linea.observaciones}
                            onChange={(e) =>
                              actualizarFilaNuevo(
                                index,
                                "observaciones",
                                e.target.value
                              )
                            }
                            style={estiloInputTabla}
                          />
                        </td>
                        <td
                          style={{ padding: "4px", border: "1px solid #ccc" }}
                        >
                          <input
                            type="text"
                            value={linea.n_pedido}
                            onChange={(e) =>
                              actualizarFilaNuevo(
                                index,
                                "n_pedido",
                                e.target.value
                              )
                            }
                            required
                            style={estiloInputTabla}
                          />
                        </td>
                        <td
                          style={{ padding: "4px", border: "1px solid #ccc" }}
                        >
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={linea.importe}
                            onChange={(e) =>
                              manejarCambioImporteNuevo(index, e.target.value)
                            }
                            style={estiloInputTabla}
                          />
                        </td>
                        <td
                          style={{ padding: "4px", border: "1px solid #ccc" }}
                        >
                          <input
                            type="text"
                            value={linea.ot}
                            onChange={(e) =>
                              actualizarFilaNuevo(index, "ot", e.target.value)
                            }
                            style={estiloInputTabla}
                          />
                        </td>
                        <td
                          style={{ padding: "4px", border: "1px solid #ccc" }}
                        >
                          <input
                            type="date"
                            value={
                              linea.fecha_recepcion !== "-"
                                ? linea.fecha_recepcion
                                : ""
                            }
                            onChange={(e) =>
                              actualizarFilaNuevo(
                                index,
                                "fecha_recepcion",
                                e.target.value
                              )
                            }
                            style={estiloInputTabla}
                          />
                        </td>
                        <td
                          style={{
                            padding: "4px",
                            border: "1px solid #ccc",
                            backgroundColor: "#e6f4ea",
                          }}
                        >
                          <input
                            type="text"
                            value={linea.coste_unitario}
                            readOnly
                            style={{
                              ...estiloInputTabla,
                              backgroundColor: "transparent",
                              border: "none",
                              color: "#137333",
                              fontWeight: "bold",
                              textAlign: "right",
                            }}
                          />
                        </td>
                        <td
                          style={{
                            padding: "4px",
                            border: "1px solid #ccc",
                            textAlign: "center",
                          }}
                        >
                          {nuevosPedidos.length > 1 && (
                            <button
                              type="button"
                              onClick={() => eliminarFilaPedido(index)}
                              style={{
                                padding: "6px",
                                backgroundColor: "#dc3545",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontWeight: "bold",
                              }}
                            >
                              ✖
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div
                  style={{
                    marginTop: "10px",
                    textAlign: "left",
                    display: "flex",
                    gap: "10px",
                  }}
                >
                  <button
                    type="button"
                    onClick={agregarFilaPedido}
                    style={{
                      padding: "8px 15px",
                      backgroundColor: "#e2e6ea",
                      color: "#333",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    ➕ Añadir fila vacía
                  </button>
                  <button
                    type="button"
                    onClick={() => setMostrarSelectorCatalogo(true)}
                    style={{
                      padding: "8px 15px",
                      backgroundColor: "#17a2b8",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    }}
                  >
                    🔍 Buscar en Catálogo
                  </button>
                  <button
                    type="button"
                    onClick={() => setMostrarModalAlertas(true)}
                    style={{
                      padding: "8px 15px",
                      backgroundColor: "#ffc107",
                      color: "#333",
                      border: "none",
                      borderRadius: "4px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    }}
                  >
                    ⚠️ Alertas
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: "15px",
                  borderTop: "1px solid #ddd",
                  paddingTop: "15px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setMostrarModalNuevo(false)}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#e2e6ea",
                    color: "#333",
                    border: "none",
                    borderRadius: "4px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    marginRight: "10px",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "10px 30px",
                    backgroundColor: "#28a745",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  ✅ Guardar Pedido en Nube
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {mostrarSelectorCatalogo && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "8px",
              width: "90%",
              maxWidth: "1000px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "15px",
                borderBottom: "2px solid #17a2b8",
                paddingBottom: "10px",
              }}
            >
              <h2 style={{ margin: 0, color: "#17a2b8" }}>
                🔍 Seleccionar Artículos del Catálogo
              </h2>
              <button
                onClick={() => setMostrarSelectorCatalogo(false)}
                style={{
                  backgroundColor: "transparent",
                  border: "none",
                  fontSize: "20px",
                  cursor: "pointer",
                  color: "#dc3545",
                  fontWeight: "bold",
                }}
              >
                ✖
              </button>
            </div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
              <select
                value={columnaMiniCatalogo}
                onChange={(e) => setColumnaMiniCatalogo(e.target.value)}
                style={{
                  padding: "10px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  fontSize: "13px",
                  backgroundColor: "#f8f9fa",
                  fontWeight: "bold",
                  width: "25%",
                }}
              >
                <option value="todas">🔍 Todas las columnas</option>
                <option value="almacen">Tipo ALMACÉN</option>
                <option value="gc">GC</option>
                <option value="nombre_siglo">Nombre en SIGLO</option>
                <option value="nombre_comun">Nombre común</option>
                <option value="tipo_articulo">Tipo Logística</option>
                <option value="ubicacion">Sección / Ubicación</option>
                <option value="referencia">Referencia</option>
                <option value="observaciones">Observaciones</option>
                <option value="incidencias">Incidencias</option>
              </select>
              <input
                type="text"
                placeholder={
                  columnaMiniCatalogo === "todas"
                    ? "Escribe para buscar..."
                    : `Buscar en ${columnaMiniCatalogo.replace("_", " ")}...`
                }
                value={busquedaMiniCatalogo}
                onChange={(e) => setBusquedaMiniCatalogo(e.target.value)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div
              style={{ overflowY: "auto", flex: 1, border: "1px solid #eee" }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "13px",
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor: "#f8f9fa",
                      position: "sticky",
                      top: 0,
                    }}
                  >
                    <th
                      style={{
                        padding: "10px",
                        borderBottom: "2px solid #ddd",
                        textAlign: "center",
                        width: "4%",
                      }}
                    >
                      ✓
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        borderBottom: "2px solid #ddd",
                      }}
                    >
                      Tipo ALMACÉN
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        borderBottom: "2px solid #ddd",
                      }}
                    >
                      GC
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        borderBottom: "2px solid #ddd",
                        width: "20%",
                      }}
                    >
                      Nombre en SIGLO
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        borderBottom: "2px solid #ddd",
                        width: "15%",
                      }}
                    >
                      Nombre común
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        borderBottom: "2px solid #ddd",
                      }}
                    >
                      Tipo Logística
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        borderBottom: "2px solid #ddd",
                      }}
                    >
                      Sección / Ubicación
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        borderBottom: "2px solid #ddd",
                      }}
                    >
                      Referencia
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        borderBottom: "2px solid #ddd",
                        width: "10%",
                      }}
                    >
                      Observaciones
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        borderBottom: "2px solid #ddd",
                        width: "10%",
                      }}
                    >
                      Incidencias
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {catalogoFiltrado.map((art, index) => {
                    const estaSeleccionado = articulosSeleccionados.some(
                      (a) => a.gc === art.gc
                    );
                    return (
                      <tr
                        key={index}
                        onClick={() => toggleSeleccionArticulo(art)}
                        style={{
                          backgroundColor: estaSeleccionado
                            ? "#e6f4ea"
                            : index % 2 === 0
                            ? "#fff"
                            : "#f9f9f9",
                          cursor: "pointer",
                          borderBottom: "1px solid #eee",
                          transition: "background-color 0.2s",
                        }}
                      >
                        <td style={{ padding: "10px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={estaSeleccionado}
                            readOnly
                            style={{
                              cursor: "pointer",
                              transform: "scale(1.2)",
                            }}
                          />
                        </td>
                        <td style={{ padding: "10px", color: "#555" }}>
                          {art.almacen}
                        </td>
                        <td style={{ padding: "10px", fontWeight: "bold" }}>
                          {art.gc}
                        </td>
                        <td style={{ padding: "10px" }}>{art.nombre_siglo}</td>
                        <td
                          style={{
                            padding: "10px",
                            fontWeight: "bold",
                            color: "#137333",
                          }}
                        >
                          {art.nombre_comun}
                        </td>
                        <td style={{ padding: "10px" }}>{art.tipo_articulo}</td>
                        <td style={{ padding: "10px", color: "#555" }}>
                          {art.ubicacion}
                        </td>
                        <td style={{ padding: "10px" }}>{art.referencia}</td>
                        <td style={{ padding: "10px", fontStyle: "italic" }}>
                          {art.observaciones}
                        </td>
                        <td
                          style={{
                            padding: "10px",
                            color:
                              art.incidencias !== "-" ? "#d32f2f" : "inherit",
                            fontWeight:
                              art.incidencias !== "-" ? "bold" : "normal",
                          }}
                        >
                          {art.incidencias}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "15px",
                borderTop: "1px solid #ddd",
                paddingTop: "15px",
              }}
            >
              <span
                style={{
                  fontWeight: "bold",
                  color: "#137333",
                  fontSize: "16px",
                }}
              >
                {articulosSeleccionados.length} artículos seleccionados
              </span>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => setMostrarSelectorCatalogo(false)}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#e2e6ea",
                    color: "#333",
                    border: "none",
                    borderRadius: "4px",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarSeleccionCatalogo}
                  style={{
                    padding: "10px 30px",
                    backgroundColor: "#17a2b8",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  ✅ Añadir al Pedido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {mostrarModalAlertas && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "8px",
              width: "90%",
              maxWidth: "800px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "15px",
                borderBottom: "2px solid #ffc107",
                paddingBottom: "10px",
              }}
            >
              <h2 style={{ margin: 0, color: "#856404" }}>
                ⚠️ TOP 10 Alertas de Reposición
              </h2>
              <button
                onClick={() => setMostrarModalAlertas(false)}
                style={{
                  backgroundColor: "transparent",
                  border: "none",
                  fontSize: "20px",
                  cursor: "pointer",
                  color: "#dc3545",
                  fontWeight: "bold",
                }}
              >
                ✖
              </button>
            </div>

            <div
              style={{
                overflowY: "auto",
                flex: 1,
                border: "1px solid #eee",
                maxHeight: "50vh",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "13px",
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor: "#f8f9fa",
                      position: "sticky",
                      top: 0,
                    }}
                  >
                    <th
                      style={{
                        padding: "10px",
                        borderBottom: "2px solid #ddd",
                        textAlign: "center",
                        width: "10%",
                      }}
                    >
                      ✓
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        borderBottom: "2px solid #ddd",
                        width: "20%",
                      }}
                    >
                      GC
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        borderBottom: "2px solid #ddd",
                        width: "50%",
                      }}
                    >
                      Artículo
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        borderBottom: "2px solid #ddd",
                        width: "20%",
                        textAlign: "center",
                      }}
                    >
                      Estimación
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topAlertas.length === 0 ? (
                    <tr>
                      <td
                        colSpan="4"
                        style={{
                          padding: "20px",
                          textAlign: "center",
                          color: "#777",
                        }}
                      >
                        ✅ No hay riesgo inminente de desabastecimiento
                        detectado en el historial.
                      </td>
                    </tr>
                  ) : (
                    topAlertas.map((art, index) => {
                      // Reutilizamos tu sistema de casillas múltiples
                      const estaSeleccionado = articulosSeleccionados.some(
                        (a) => a.gc === art.gc
                      );

                      return (
                        <tr
                          key={index}
                          onClick={() => toggleSeleccionArticulo(art)}
                          style={{
                            backgroundColor: estaSeleccionado
                              ? "#fff3cd"
                              : index % 2 === 0
                              ? "#fff"
                              : "#f9f9f9",
                            cursor: "pointer",
                            borderBottom: "1px solid #eee",
                          }}
                        >
                          <td style={{ padding: "10px", textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={estaSeleccionado}
                              readOnly
                              style={{
                                cursor: "pointer",
                                transform: "scale(1.2)",
                              }}
                            />
                          </td>
                          <td style={{ padding: "10px", fontWeight: "bold" }}>
                            {art.gc}
                          </td>
                          <td style={{ padding: "10px" }}>
                            {art.nombre_siglo || art.nombre_comun}
                          </td>
                          <td
                            style={{
                              padding: "10px",
                              textAlign: "center",
                              color: "#d32f2f",
                              fontWeight: "bold",
                            }}
                          >
                            {art.diasRestantes < 0
                              ? "¡Agotado!"
                              : `Agotamiento en ${art.diasRestantes} días`}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "15px",
                borderTop: "1px solid #ddd",
                paddingTop: "15px",
              }}
            >
              <span
                style={{
                  fontWeight: "bold",
                  color: "#856404",
                  fontSize: "16px",
                }}
              >
                {articulosSeleccionados.length} artículos listos para incluir
              </span>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => setMostrarModalAlertas(false)}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#e2e6ea",
                    color: "#333",
                    border: "none",
                    borderRadius: "4px",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  Cerrar
                </button>
                <button
                  onClick={() => {
                    // Aprovechamos tu función existente para inyectarlos en las líneas de pedido
                    confirmarSeleccionCatalogo();
                    setMostrarModalAlertas(false);
                  }}
                  style={{
                    padding: "10px 30px",
                    backgroundColor: "#ffc107",
                    color: "#333",
                    border: "none",
                    borderRadius: "4px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  ✅ Añadir al Pedido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {mostrarModalImportar && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "30px",
              borderRadius: "8px",
              width: "95%",
              maxWidth: "800px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "15px",
                borderBottom: "2px solid #17a2b8",
                paddingBottom: "10px",
              }}
            >
              <h2 style={{ margin: 0, color: "#17a2b8" }}>
                📥 Importar Pedidos a la Nube
              </h2>
              <button
                onClick={() => setMostrarModalImportar(false)}
                style={{
                  backgroundColor: "transparent",
                  border: "none",
                  fontSize: "20px",
                  cursor: "pointer",
                  color: "#dc3545",
                  fontWeight: "bold",
                }}
              >
                ✖
              </button>
            </div>
            <p style={{ color: "#555", fontSize: "14px" }}>
              Copia las filas desde tu Excel de Pedidos y pégalas aquí.
              Asegúrate de que las columnas están en este orden exacto:
              <br />
              <br />
              <strong>
                1. Días | 2. Fecha | 3. Almacén | 4. GC | 5. Artículo | 6. Uds |
                7. Tipo | 8. Observaciones | 9. Nº Pedido | 10. Importe | 11. OT
                | 12. Recepción | 13. Coste/ud
              </strong>
            </p>
            <textarea
              value={textoImportacion}
              onChange={(e) => setTextoImportacion(e.target.value)}
              placeholder="Pega aquí los datos de Excel (Ctrl + V)..."
              style={{
                width: "100%",
                height: "200px",
                padding: "10px",
                border: "2px dashed #17a2b8",
                borderRadius: "8px",
                boxSizing: "border-box",
                fontFamily: "monospace",
                backgroundColor: "#f8f9fa",
                resize: "vertical",
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "15px",
                gap: "10px",
              }}
            >
              <button
                onClick={() => setMostrarModalImportar(false)}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#e2e6ea",
                  color: "#333",
                  border: "none",
                  borderRadius: "4px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={procesarImportacion}
                style={{
                  padding: "10px 30px",
                  backgroundColor: "#17a2b8",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Subir a la Nube
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
