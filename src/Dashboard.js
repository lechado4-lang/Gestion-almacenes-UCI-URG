import React from "react";

export default function Dashboard({ articulos, listaPedidos }) {
  // 1. CEREBRO FINANCIERO
  const parsearImporte = (importeStr) => {
    if (!importeStr || importeStr === "-" || importeStr === "nan") return 0;
    const numeroLimpio = String(importeStr)
      .replace("€", "")
      .replace(",", ".")
      .trim();
    return parseFloat(numeroLimpio) || 0;
  };

  const gastoTotal = listaPedidos.reduce(
    (total, pedido) => total + parsearImporte(pedido.importe),
    0
  );
  const gastoUCI = listaPedidos
    .filter((p) => p.almacen.includes("UCI"))
    .reduce((total, pedido) => total + parsearImporte(pedido.importe), 0);
  const gastoURG = listaPedidos
    .filter((p) => p.almacen.includes("URG"))
    .reduce((total, pedido) => total + parsearImporte(pedido.importe), 0);
  const pedidosPendientes = listaPedidos.filter(
    (p) =>
      !p.fecha_recepcion ||
      p.fecha_recepcion === "nan" ||
      p.fecha_recepcion === "-"
  ).length;

  // 2. CEREBRO LOGÍSTICO PREDICTIVO
  const generarAlertas = () => {
    const hoy = new Date();
    const resultados = [];

    // Analizamos cada artículo del catálogo uno por uno
    articulos.forEach((art) => {
      // Buscamos todos los pedidos de este artículo en el historial
      const susPedidos = listaPedidos.filter(
        (p) =>
          p.gc === art.gc && p.fecha && p.fecha !== "-" && p.fecha !== "nan"
      );

      // Convertimos las fechas a objetos Date reales para poder hacer matemáticas y las ordenamos de más antigua a más nueva
      const fechas = susPedidos
        .map((p) => new Date(p.fecha))
        .filter((d) => !isNaN(d.getTime()))
        .sort((a, b) => a - b);

      // Si se ha pedido 2 o más veces, podemos calcular la frecuencia matemática
      if (fechas.length >= 2) {
        const primeraFecha = fechas[0];
        const ultimaFecha = fechas[fechas.length - 1];

        // Calculamos los días totales entre el primer y último pedido
        const diasTotales =
          (ultimaFecha - primeraFecha) / (1000 * 60 * 60 * 24);
        // Frecuencia media (cada cuántos días se pide)
        const frecuenciaMedia = diasTotales / (fechas.length - 1);

        // ¿Cuántos días han pasado desde el último pedido hasta HOY?
        const diasDesdeUltimo = (hoy - ultimaFecha) / (1000 * 60 * 60 * 24);

        // Predicción: ¿Cuántos días quedan para que se agote?
        const diasRestantes = Math.round(frecuenciaMedia - diasDesdeUltimo);

        resultados.push({
          ...art,
          frecuencia: Math.round(frecuenciaMedia),
          ultimoPedido: ultimaFecha,
          diasRestantes: diasRestantes,
          estado:
            diasRestantes <= 0
              ? "CRÍTICO"
              : diasRestantes <= 4
              ? "ALERTA"
              : "BIEN",
        });
      }
      // Si solo se ha pedido 1 vez, no podemos predecir aún
      else if (fechas.length === 1) {
        resultados.push({
          ...art,
          frecuencia: "Calculando...",
          ultimoPedido: fechas[0],
          diasRestantes: null,
          estado: "APRENDIENDO",
        });
      }
    });

    // Ordenamos la tabla para que los más urgentes salgan arriba del todo
    return resultados.sort((a, b) => {
      if (a.diasRestantes === null) return 1;
      if (b.diasRestantes === null) return -1;
      return a.diasRestantes - b.diasRestantes;
    });
  };

  const alertas = generarAlertas();

  // 3. DISEÑO DE TARJETAS
  const estiloTarjeta = {
    flex: 1,
    minWidth: "200px",
    backgroundColor: "#f8f9fa",
    padding: "20px",
    borderRadius: "10px",
    boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
    borderLeft: "6px solid #0056b3",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  };

  // Función para formatear fechas al estilo DD/MM/AAAA
  const formatearFecha = (fechaObj) => {
    if (!fechaObj) return "-";
    const dia = String(fechaObj.getDate()).padStart(2, "0");
    const mes = String(fechaObj.getMonth() + 1).padStart(2, "0");
    return `${dia}/${mes}/${fechaObj.getFullYear()}`;
  };

  return (
    <div
      style={{
        backgroundColor: "white",
        padding: "20px",
        borderRadius: "8px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
        width: "100%",
        boxSizing: "border-box",
        minHeight: "80vh",
      }}
    >
      <h2
        style={{
          color: "#333",
          marginTop: 0,
          borderBottom: "2px solid #0056b3",
          paddingBottom: "10px",
          marginBottom: "25px",
        }}
      >
        📊 Panel de Inteligencia y Predicción
      </h2>

      {/* SECCIÓN 1: TARJETAS */}
      <div
        style={{
          display: "flex",
          gap: "20px",
          flexWrap: "wrap",
          marginBottom: "30px",
        }}
      >
        <div style={{ ...estiloTarjeta, borderLeftColor: "#0056b3" }}>
          <span
            style={{
              fontSize: "13px",
              color: "#6c757d",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Gasto Total Histórico
          </span>
          <span
            style={{
              fontSize: "32px",
              fontWeight: "bold",
              color: "#333",
              marginTop: "8px",
            }}
          >
            {gastoTotal.toLocaleString("es-ES", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            €
          </span>
        </div>
        <div style={{ ...estiloTarjeta, borderLeftColor: "#17a2b8" }}>
          <span
            style={{
              fontSize: "13px",
              color: "#6c757d",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Gasto UCI
          </span>
          <span
            style={{
              fontSize: "32px",
              fontWeight: "bold",
              color: "#333",
              marginTop: "8px",
            }}
          >
            {gastoUCI.toLocaleString("es-ES", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            €
          </span>
        </div>
        <div style={{ ...estiloTarjeta, borderLeftColor: "#ffc107" }}>
          <span
            style={{
              fontSize: "13px",
              color: "#6c757d",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Gasto Urgencias
          </span>
          <span
            style={{
              fontSize: "32px",
              fontWeight: "bold",
              color: "#333",
              marginTop: "8px",
            }}
          >
            {gastoURG.toLocaleString("es-ES", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            €
          </span>
        </div>
        <div
          style={{
            ...estiloTarjeta,
            borderLeftColor: "#dc3545",
            backgroundColor: pedidosPendientes > 0 ? "#fff5f5" : "#f8f9fa",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              color: "#dc3545",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            ⏳ Pedidos Pendientes
          </span>
          <span
            style={{
              fontSize: "32px",
              fontWeight: "bold",
              color: "#dc3545",
              marginTop: "8px",
            }}
          >
            {pedidosPendientes}
          </span>
        </div>
      </div>

      {/* SECCIÓN 2: ALGORITMO PREDICTIVO DE STOCK */}
      <h3
        style={{
          color: "#333",
          marginTop: "30px",
          marginBottom: "15px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "20px",
        }}
      >
        🤖 Asistente de Reposición Inteligente
      </h3>
      <p style={{ color: "#666", fontSize: "14px", marginBottom: "20px" }}>
        La aplicación analiza tu historial para calcular cada cuántos días
        sueles pedir un artículo y predice cuándo se te agotará.
        <strong> No necesitas contar stock a mano.</strong>
      </p>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "13px",
            textAlign: "left",
            tableLayout: "auto",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "#343a40", color: "white" }}>
              <th style={{ padding: "10px", border: "1px solid #454d55" }}>
                Almacén
              </th>
              <th style={{ padding: "10px", border: "1px solid #454d55" }}>
                GC
              </th>
              <th style={{ padding: "10px", border: "1px solid #454d55" }}>
                Artículo
              </th>
              <th
                style={{
                  padding: "10px",
                  border: "1px solid #454d55",
                  textAlign: "center",
                }}
              >
                Frecuencia Habitual
              </th>
              <th
                style={{
                  padding: "10px",
                  border: "1px solid #454d55",
                  textAlign: "center",
                }}
              >
                Último Pedido
              </th>
              <th
                style={{
                  padding: "10px",
                  border: "1px solid #454d55",
                  textAlign: "center",
                }}
              >
                Estimación para agotar
              </th>
              <th
                style={{
                  padding: "10px",
                  border: "1px solid #454d55",
                  textAlign: "center",
                }}
              >
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {alertas.map((alerta, index) => {
              // Definimos los colores y textos según el estado de urgencia
              let colorFondo = "#fff";
              let icono = "";
              let textoPrediccion = "";

              if (alerta.estado === "CRÍTICO") {
                colorFondo = "#fff5f5"; // Rojo muy pálido
                icono = "🔴 URGENTE";
                textoPrediccion =
                  alerta.diasRestantes < 0
                    ? `Debió pedirse hace ${Math.abs(
                        alerta.diasRestantes
                      )} días`
                    : "Se agota HOY";
              } else if (alerta.estado === "ALERTA") {
                colorFondo = "#fffdf0"; // Amarillo muy pálido
                icono = "🟠 PRONTO";
                textoPrediccion = `Faltan ${alerta.diasRestantes} días`;
              } else if (alerta.estado === "BIEN") {
                icono = "🟢 STOCK SALUDABLE";
                textoPrediccion = `Faltan ${alerta.diasRestantes} días`;
              } else {
                colorFondo = "#f8f9fa"; // Gris
                icono = "⚪ APRENDIENDO";
                textoPrediccion = "Necesita 2+ pedidos";
              }

              return (
                <tr
                  key={index}
                  style={{
                    backgroundColor: colorFondo,
                    borderBottom: "1px solid #ddd",
                  }}
                >
                  <td style={{ padding: "10px", border: "1px solid #ddd" }}>
                    {alerta.almacen}
                  </td>
                  <td
                    style={{
                      padding: "10px",
                      border: "1px solid #ddd",
                      fontWeight: "bold",
                    }}
                  >
                    {alerta.gc}
                  </td>
                  <td style={{ padding: "10px", border: "1px solid #ddd" }}>
                    {alerta.nombre_siglo || alerta.nombre_comun}
                  </td>
                  <td
                    style={{
                      padding: "10px",
                      border: "1px solid #ddd",
                      textAlign: "center",
                      color: "#555",
                    }}
                  >
                    {alerta.frecuencia === "Calculando..."
                      ? "-"
                      : `Cada ${alerta.frecuencia} días`}
                  </td>
                  <td
                    style={{
                      padding: "10px",
                      border: "1px solid #ddd",
                      textAlign: "center",
                      color: "#555",
                    }}
                  >
                    {formatearFecha(alerta.ultimoPedido)}
                  </td>
                  <td
                    style={{
                      padding: "10px",
                      border: "1px solid #ddd",
                      textAlign: "center",
                      fontWeight: "bold",
                      color: alerta.estado === "CRÍTICO" ? "#d32f2f" : "#333",
                    }}
                  >
                    {textoPrediccion}
                  </td>
                  <td
                    style={{
                      padding: "10px",
                      border: "1px solid #ddd",
                      textAlign: "center",
                      fontWeight: "bold",
                      fontSize: "12px",
                    }}
                  >
                    {icono}
                  </td>
                </tr>
              );
            })}

            {/* Mensaje si no hay ningún historial para analizar */}
            {alertas.length === 0 && (
              <tr>
                <td
                  colSpan="7"
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "#777",
                    fontStyle: "italic",
                  }}
                >
                  No hay suficientes datos en el historial para generar
                  predicciones. Registra tus pedidos para que la aplicación
                  comience a aprender.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
