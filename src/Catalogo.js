import React, { useState } from "react";

export default function Catalogo({
  listaArticulos,
  setListaArticulos,
  usuarioActual,
}) {
  const [busquedaCatalogo, setBusquedaCatalogo] = useState("");
  const [columnaBusqueda, setColumnaBusqueda] = useState("todas");
  const [filtroAlmacen, setFiltroAlmacen] = useState("Todos");
  const [filtrosColumna, setFiltrosColumna] = useState({});
  const [menuColumnaAbierto, setMenuColumnaAbierto] = useState(null);
  const [busquedaMenu, setBusquedaMenu] = useState("");
  const [seleccionesTemporales, setSeleccionesTemporales] = useState([]);

  // Memorias para controlar cuándo se ven las ventanas flotantes
  const [mostrarModalUnico, setMostrarModalUnico] = useState(false);
  const [mostrarModalImportar, setMostrarModalImportar] = useState(false);

  // Memoria para guardar VARIAS filas de "Nuevos Artículos" a la vez
  const [nuevosArticulos, setNuevosArticulos] = useState([
    {
      almacen: "UCI Manual",
      gc: "",
      nombre_siglo: "",
      nombre_comun: "",
      tipo_articulo: "ALMACENABLE",
      ubicacion: "",
      referencia: "",
      observaciones: "",
      incidencias: "-",
    },
  ]);

  // Memoria para la importación desde Excel
  const [textoImportacion, setTextoImportacion] = useState("");

  // NUEVAS MEMORIAS PARA LA EDICIÓN DEL CATÁLOGO
  const [filaEditandoCat, setFilaEditandoCat] = useState(null);
  const [tempArticulo, setTempArticulo] = useState({});

  // FUNCIONES PARA EDITAR
  const iniciarEdicionCat = (indexReal, articulo) => {
    setFilaEditandoCat(indexReal);
    setTempArticulo({ ...articulo }); // Copiamos los datos actuales para poder modificarlos
  };

  const guardarEdicionCat = (indexReal) => {
    const copia = [...listaArticulos];
    copia[indexReal] = tempArticulo;
    setListaArticulos(copia);
    setFilaEditandoCat(null); // Cerramos el modo edición
  };

  // Añadimos el indexReal antes de filtrar para que no se equivoque de fila al editar
  const articulosConIndice = listaArticulos.map((art, index) => ({
    ...art,
    indexReal: index,
  }));

  const articulosFiltrados = articulosConIndice.filter((articulo) => {
    // 1. MURO DE SEGURIDAD (Ya existente)
    const tienePermiso =
      usuarioActual.rol === "admin" ||
      usuarioActual.almacenes.some(
        (almacenPermitido) =>
          articulo.almacen && articulo.almacen.includes(almacenPermitido)
      );
    if (!tienePermiso) return false;

    // 2. BUSCADOR NORMAL (Ya existente)
    const textoBuscado = busquedaCatalogo.toLowerCase();
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

    const coincideTexto =
      columnaBusqueda === "todas"
        ? todasLasColumnas.some((col) =>
            String(articulo[col] || "")
              .toLowerCase()
              .includes(textoBuscado)
          )
        : String(articulo[columnaBusqueda] || "")
            .toLowerCase()
            .includes(textoBuscado);

    const coincideAlmacen =
      filtroAlmacen === "Todos" ? true : articulo.almacen === filtroAlmacen;

    // --- NUEVA CRIBA: FILTROS DINÁMICOS MÚLTIPLES ---
    let cumpleFiltrosColumna = true;
    Object.keys(filtrosColumna).forEach((campoBD) => {
      const selecciones = filtrosColumna[campoBD];
      // Si hay selecciones marcadas en esa columna, comprobamos si el artículo coincide
      if (selecciones && selecciones.length > 0) {
        if (!selecciones.includes(String(articulo[campoBD]))) {
          cumpleFiltrosColumna = false; // El artículo no pasa el filtro
        }
      }
    });

    // Ahora devolvemos el resultado de TODAS las condiciones juntas
    return coincideTexto && coincideAlmacen && cumpleFiltrosColumna;
  });

  // Función para guardar TODOS los artículos de las filas
  const guardarNuevosArticulos = (e) => {
    e.preventDefault();

    // Filtramos para ignorar las filas que se hayan quedado vacías (sin escribir GC)
    const articulosValidos = nuevosArticulos
      .filter((art) => art.gc.trim() !== "")
      .map((art, index) => ({ ...art, id: Date.now() + index })); // ID único a cada uno

    if (articulosValidos.length > 0) {
      setListaArticulos([...articulosValidos, ...listaArticulos]);
    }

    setMostrarModalUnico(false);
    // Reseteamos dejando solo 1 fila vacía para la próxima vez
    setNuevosArticulos([
      {
        almacen: "UCI Manual",
        gc: "",
        nombre_siglo: "",
        nombre_comun: "",
        tipo_articulo: "ALMACENABLE",
        ubicacion: "",
        referencia: "",
        observaciones: "",
        incidencias: "-",
      },
    ]);
  };

  // Función para AÑADIR una fila en blanco abajo
  const agregarFila = () => {
    setNuevosArticulos([
      ...nuevosArticulos,
      {
        almacen: "UCI Manual",
        gc: "",
        nombre_siglo: "",
        nombre_comun: "",
        tipo_articulo: "ALMACENABLE",
        ubicacion: "",
        referencia: "",
        observaciones: "",
        incidencias: "-",
      },
    ]);
  };

  // Función para ACTUALIZAR lo que escribes en una celda concreta
  const actualizarCelda = (index, campo, valor) => {
    const copia = [...nuevosArticulos];
    copia[index][campo] = valor;
    setNuevosArticulos(copia);
  };

  // Función para ELIMINAR una fila concreta con el botón de la papelera
  const eliminarFila = (index) => {
    if (nuevosArticulos.length > 1) {
      const copia = nuevosArticulos.filter((_, i) => i !== index);
      setNuevosArticulos(copia);
    }
  };

  // Función MÁGICA para procesar el texto copiado de Excel
  const procesarImportacion = () => {
    if (!textoImportacion.trim()) return;

    // Al copiar de Excel, las filas se separan por salto de línea (\n)
    const lineas = textoImportacion.split("\n");
    const nuevosArts = [];

    lineas.forEach((linea) => {
      if (!linea.trim()) return;
      // Y las columnas de Excel se separan por tabulaciones (\t)
      const col = linea.split("\t");

      // Aseguramos que la fila tiene al menos un GC (columna 2) para ser válida
      if (col.length >= 2 && col[1].trim() !== "") {
        nuevosArts.push({
          id: Date.now() + Math.random(),
          almacen: col[0]?.trim() || "UCI Manual",
          gc: col[1]?.trim() || "",
          nombre_siglo: col[2]?.trim() || "",
          nombre_comun: col[3]?.trim() || "",
          tipo_articulo: col[4]?.trim() || "ALMACENABLE",
          ubicacion: col[5]?.trim() || "-",
          referencia: col[6]?.trim() || "-",
          observaciones: col[7]?.trim() || "-",
          incidencias: col[8]?.trim() || "-",
        });
      }
    });

    if (nuevosArts.length > 0) {
      setListaArticulos([...nuevosArts, ...listaArticulos]);
      alert(
        `¡Éxito! Se han importado ${nuevosArts.length} artículos al catálogo.`
      );
    } else {
      alert(
        "No se detectó un formato válido. Asegúrate de copiar las 9 columnas desde el Excel."
      );
    }

    setMostrarModalImportar(false);
    setTextoImportacion("");
  };

  const estiloBotonFiltro = (nombreBoton) => ({
    padding: "8px 16px",
    borderRadius: "20px",
    border: "2px solid #0056b3",
    backgroundColor: filtroAlmacen === nombreBoton ? "#0056b3" : "white",
    color: filtroAlmacen === nombreBoton ? "white" : "#0056b3",
    fontWeight: "bold",
    cursor: "pointer",
    flex: 1,
  });

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
        articulosFiltrados // <--- CIRUGÍA APLICADA: Ahora miramos los ya cribados
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
        <h2 style={{ color: "#333", margin: 0 }}>📦 Catálogo de Artículos</h2>

        {/* BOTONES DE AÑADIR */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => setMostrarModalUnico(true)}
            style={{
              padding: "8px 15px",
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "5px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            + Nuevo Artículo
          </button>
          <button
            onClick={() => setMostrarModalImportar(true)}
            style={{
              padding: "8px 15px",
              backgroundColor: "#17a2b8",
              color: "white",
              border: "none",
              borderRadius: "5px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            📥 Importar de Excel
          </button>
        </div>
      </div>

      {/* NUEVA BARRA DE BÚSQUEDA AVANZADA */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
        <select
          value={columnaBusqueda}
          onChange={(e) => setColumnaBusqueda(e.target.value)}
          style={{
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            fontSize: "14px",
            backgroundColor: "#f8f9fa",
            fontWeight: "bold",
            width: "25%",
          }}
        >
          <option value="todas">🔍 En todas las columnas</option>
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
            columnaBusqueda === "todas"
              ? "Escribe para buscar en cualquier sitio..."
              : `Buscar en ${columnaBusqueda.replace("_", " ")}...`
          }
          value={busquedaCatalogo}
          onChange={(e) => setBusquedaCatalogo(e.target.value)}
          style={{
            flex: 1,
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            fontSize: "16px",
            boxSizing: "border-box",
            backgroundColor: "#fdfdfd",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "20px",
          maxWidth: "600px",
        }}
      >
        <button
          style={estiloBotonFiltro("Todos")}
          onClick={() => setFiltroAlmacen("Todos")}
        >
          Todos
        </button>
        <button
          style={estiloBotonFiltro("UCI Manual")}
          onClick={() => setFiltroAlmacen("UCI Manual")}
        >
          UCI
        </button>
        <button
          style={estiloBotonFiltro("URG Manual")}
          onClick={() => setFiltroAlmacen("URG Manual")}
        >
          Urgencias
        </button>
      </div>

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
              {renderCabeceraDinamica("Tipo ALMACÉN", "almacen")}
              {renderCabeceraDinamica("GC", "gc")}
              {renderCabeceraDinamica("Nombre en SIGLO", "nombre_siglo", "20%")}
              {renderCabeceraDinamica("Nombre común", "nombre_comun", "15%")}
              {renderCabeceraDinamica("Tipo Logística", "tipo_articulo")}
              {renderCabeceraDinamica("Sección / Ubicación", "ubicacion")}
              {renderCabeceraDinamica("Referencia", "referencia")}
              {renderCabeceraDinamica("Observaciones", "observaciones", "12%")}
              {renderCabeceraDinamica("Incidencias", "incidencias", "12%")}

              {/* La columna de Acciones se queda estática porque solo contiene botones de edición */}
              <th
                style={{
                  padding: "8px",
                  border: "1px solid #ddd",
                  textAlign: "center",
                  width: "8%",
                }}
              >
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {articulosFiltrados.map((articulo) => {
              const index = articulo.indexReal;
              const esFilaEditada = filaEditandoCat === index;

              return (
                <tr
                  key={articulo.id || index}
                  style={{
                    backgroundColor: esFilaEditada
                      ? "#fff8b0"
                      : index % 2 === 0
                      ? "#f9f9f9"
                      : "white",
                    borderBottom: "1px solid #ddd",
                    transition: "background-color 0.2s",
                  }}
                >
                  <td style={{ padding: "6px", border: "1px solid #ddd" }}>
                    {esFilaEditada ? (
                      <select
                        value={tempArticulo.almacen}
                        onChange={(e) =>
                          setTempArticulo({
                            ...tempArticulo,
                            almacen: e.target.value,
                          })
                        }
                        style={estiloInputTabla}
                      >
                        <option value="UCI Manual">UCI Manual</option>
                        <option value="URG Manual">URG Manual</option>
                        <option value="QUIROFANO">QUIROFANO</option>
                      </select>
                    ) : (
                      articulo.almacen
                    )}
                  </td>

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
                        value={tempArticulo.gc}
                        onChange={(e) =>
                          setTempArticulo({
                            ...tempArticulo,
                            gc: e.target.value,
                          })
                        }
                        style={estiloInputTabla}
                      />
                    ) : (
                      articulo.gc
                    )}
                  </td>

                  <td style={{ padding: "6px", border: "1px solid #ddd" }}>
                    {esFilaEditada ? (
                      <input
                        type="text"
                        value={tempArticulo.nombre_siglo}
                        onChange={(e) =>
                          setTempArticulo({
                            ...tempArticulo,
                            nombre_siglo: e.target.value,
                          })
                        }
                        style={estiloInputTabla}
                      />
                    ) : (
                      articulo.nombre_siglo
                    )}
                  </td>

                  <td
                    style={{
                      padding: "6px",
                      border: "1px solid #ddd",
                      fontWeight: "bold",
                      color: "#137333",
                    }}
                  >
                    {esFilaEditada ? (
                      <input
                        type="text"
                        value={tempArticulo.nombre_comun}
                        onChange={(e) =>
                          setTempArticulo({
                            ...tempArticulo,
                            nombre_comun: e.target.value,
                          })
                        }
                        style={{
                          ...estiloInputTabla,
                          border: "2px solid #137333",
                        }}
                      />
                    ) : (
                      articulo.nombre_comun
                    )}
                  </td>

                  <td style={{ padding: "6px", border: "1px solid #ddd" }}>
                    {esFilaEditada ? (
                      <select
                        value={tempArticulo.tipo_articulo}
                        onChange={(e) =>
                          setTempArticulo({
                            ...tempArticulo,
                            tipo_articulo: e.target.value,
                          })
                        }
                        style={estiloInputTabla}
                      >
                        <option value="ALMACENABLE">ALMACENABLE</option>
                        <option value="TRÁNSITO">TRÁNSITO</option>
                      </select>
                    ) : (
                      articulo.tipo_articulo
                    )}
                  </td>

                  <td style={{ padding: "6px", border: "1px solid #ddd" }}>
                    {esFilaEditada ? (
                      <input
                        type="text"
                        value={tempArticulo.ubicacion}
                        onChange={(e) =>
                          setTempArticulo({
                            ...tempArticulo,
                            ubicacion: e.target.value,
                          })
                        }
                        style={estiloInputTabla}
                      />
                    ) : (
                      articulo.ubicacion
                    )}
                  </td>

                  <td style={{ padding: "6px", border: "1px solid #ddd" }}>
                    {esFilaEditada ? (
                      <input
                        type="text"
                        value={tempArticulo.referencia}
                        onChange={(e) =>
                          setTempArticulo({
                            ...tempArticulo,
                            referencia: e.target.value,
                          })
                        }
                        style={estiloInputTabla}
                      />
                    ) : (
                      articulo.referencia
                    )}
                  </td>

                  <td
                    style={{
                      padding: "6px",
                      border: "1px solid #ddd",
                      fontStyle: "italic",
                    }}
                  >
                    {esFilaEditada ? (
                      <input
                        type="text"
                        value={tempArticulo.observaciones}
                        onChange={(e) =>
                          setTempArticulo({
                            ...tempArticulo,
                            observaciones: e.target.value,
                          })
                        }
                        style={estiloInputTabla}
                      />
                    ) : (
                      articulo.observaciones
                    )}
                  </td>

                  <td
                    style={{
                      padding: "6px",
                      border: "1px solid #ddd",
                      color:
                        !esFilaEditada && articulo.incidencias !== "-"
                          ? "#d32f2f"
                          : "inherit",
                      fontWeight:
                        !esFilaEditada && articulo.incidencias !== "-"
                          ? "bold"
                          : "normal",
                    }}
                  >
                    {esFilaEditada ? (
                      <input
                        type="text"
                        value={tempArticulo.incidencias}
                        onChange={(e) =>
                          setTempArticulo({
                            ...tempArticulo,
                            incidencias: e.target.value,
                          })
                        }
                        style={estiloInputTabla}
                      />
                    ) : (
                      articulo.incidencias
                    )}
                  </td>

                  {/* NUEVA COLUMNA DE BOTONES DE ACCIÓN */}
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
                          onClick={() => guardarEdicionCat(index)}
                          style={{
                            padding: "4px 8px",
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
                          onClick={() => setFilaEditandoCat(null)}
                          style={{
                            padding: "4px 8px",
                            backgroundColor: "#dc3545",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                          title="Cancelar"
                        >
                          ❌
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => iniciarEdicionCat(index, articulo)}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "#e2e6ea",
                          border: "1px solid #ccc",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "12px",
                          color: "#333",
                        }}
                        title="Editar Artículo"
                      >
                        ✏️
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL 1: AÑADIR VARIOS ARTÍCULOS */}
      {mostrarModalUnico && (
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
          {/* Hemos puesto maxHeight para que, si añades 20 filas, puedas hacer scroll dentro de la ventana sin que se salga de la pantalla */}
          <div
            style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "8px",
              width: "95%",
              maxWidth: "1300px",
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
                borderBottom: "2px solid #28a745",
                paddingBottom: "10px",
              }}
            >
              <h2 style={{ margin: 0, color: "#28a745" }}>
                + Añadir Nuevos Artículos
              </h2>
              <button
                onClick={() => setMostrarModalUnico(false)}
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
              onSubmit={guardarNuevosArticulos}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                overflow: "hidden",
              }}
            >
              <div
                style={{ overflowY: "auto", flex: 1, paddingBottom: "10px" }}
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
                      <th style={{ padding: "8px", border: "1px solid #ccc" }}>
                        ALMACÉN
                      </th>
                      <th style={{ padding: "8px", border: "1px solid #ccc" }}>
                        GC
                      </th>
                      <th
                        style={{
                          padding: "8px",
                          border: "1px solid #ccc",
                          width: "20%",
                        }}
                      >
                        Nombre SIGLO
                      </th>
                      <th style={{ padding: "8px", border: "1px solid #ccc" }}>
                        Nombre Común
                      </th>
                      <th style={{ padding: "8px", border: "1px solid #ccc" }}>
                        Tipo
                      </th>
                      <th style={{ padding: "8px", border: "1px solid #ccc" }}>
                        Ubicación
                      </th>
                      <th style={{ padding: "8px", border: "1px solid #ccc" }}>
                        Referencia
                      </th>
                      <th style={{ padding: "8px", border: "1px solid #ccc" }}>
                        Observaciones
                      </th>
                      <th style={{ padding: "8px", border: "1px solid #ccc" }}>
                        Incidencias
                      </th>
                      <th
                        style={{
                          padding: "8px",
                          border: "1px solid #ccc",
                          textAlign: "center",
                        }}
                      >
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Hacemos un "map" para pintar tantas filas como haya en la memoria */}
                    {nuevosArticulos.map((art, index) => (
                      <tr key={index}>
                        <td
                          style={{ padding: "4px", border: "1px solid #ccc" }}
                        >
                          <select
                            value={art.almacen}
                            onChange={(e) =>
                              actualizarCelda(index, "almacen", e.target.value)
                            }
                            style={estiloInputTabla}
                          >
                            <option value="UCI Manual">UCI</option>
                            <option value="URG Manual">URG</option>
                            <option value="QUIROFANO">QUIROFANO</option>
                          </select>
                        </td>
                        <td
                          style={{ padding: "4px", border: "1px solid #ccc" }}
                        >
                          <input
                            type="text"
                            value={art.gc}
                            onChange={(e) =>
                              actualizarCelda(index, "gc", e.target.value)
                            }
                            required
                            style={estiloInputTabla}
                          />
                        </td>
                        <td
                          style={{ padding: "4px", border: "1px solid #ccc" }}
                        >
                          <input
                            type="text"
                            value={art.nombre_siglo}
                            onChange={(e) =>
                              actualizarCelda(
                                index,
                                "nombre_siglo",
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
                            type="text"
                            value={art.nombre_comun}
                            onChange={(e) =>
                              actualizarCelda(
                                index,
                                "nombre_comun",
                                e.target.value
                              )
                            }
                            required
                            style={{
                              ...estiloInputTabla,
                              border: "2px solid #137333",
                            }}
                          />
                        </td>
                        <td
                          style={{ padding: "4px", border: "1px solid #ccc" }}
                        >
                          <select
                            value={art.tipo_articulo}
                            onChange={(e) =>
                              actualizarCelda(
                                index,
                                "tipo_articulo",
                                e.target.value
                              )
                            }
                            style={estiloInputTabla}
                          >
                            <option value="ALMACENABLE">ALMACENABLE</option>
                            <option value="TRÁNSITO">TRÁNSITO</option>
                          </select>
                        </td>
                        <td
                          style={{ padding: "4px", border: "1px solid #ccc" }}
                        >
                          <input
                            type="text"
                            value={art.ubicacion}
                            onChange={(e) =>
                              actualizarCelda(
                                index,
                                "ubicacion",
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
                            value={art.referencia}
                            onChange={(e) =>
                              actualizarCelda(
                                index,
                                "referencia",
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
                            value={art.observaciones}
                            onChange={(e) =>
                              actualizarCelda(
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
                            value={art.incidencias}
                            onChange={(e) =>
                              actualizarCelda(
                                index,
                                "incidencias",
                                e.target.value
                              )
                            }
                            style={estiloInputTabla}
                          />
                        </td>

                        {/* Botón Papelera: Solo sale si hay más de 1 fila */}
                        <td
                          style={{
                            padding: "4px",
                            border: "1px solid #ccc",
                            textAlign: "center",
                          }}
                        >
                          {nuevosArticulos.length > 1 && (
                            <button
                              type="button"
                              onClick={() => eliminarFila(index)}
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
                              🗑️
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* BOTÓN PARA AÑADIR FILAS */}
                <div style={{ marginTop: "10px", textAlign: "left" }}>
                  <button
                    type="button"
                    onClick={agregarFila}
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
                    ➕ Añadir otra fila
                  </button>
                </div>
              </div>

              {/* BOTONES FINALES DE GUARDAR Y CANCELAR */}
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
                  onClick={() => setMostrarModalUnico(false)}
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
                  }}
                >
                  ✅ Guardar en Catálogo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL 2: IMPORTAR DESDE EXCEL */}
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
                📥 Importar o Pegar desde Excel
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
              Ve a tu hoja de Excel "Artículos ALMACENES", selecciona las filas
              (sin la cabecera) asegurándote de que las columnas están en este
              orden:
              <br />
              <strong>
                1. Almacén | 2. GC | 3. Nombre SIGLO | 4. Nombre Común | 5. Tipo
                | 6. Ubicación | 7. Referencia | 8. Observaciones | 9.
                Incidencias
              </strong>
              <br />
              Cópialas y pégalas directamente en esta caja:
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
                Procesar Datos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
