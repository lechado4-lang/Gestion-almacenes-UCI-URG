import React, { useState, useEffect } from "react";
import "./styles.css";

// ❌ ADIÓS A LOS ARCHIVOS LOCALES (Los hemos borrado virtualmente)
// import articulos from "./datos.json";
// import pedidosIniciales from "./pedidos.json";

import Catalogo from "./Catalogo";
import Historial from "./Historial";
import Dashboard from "./Dashboard";
import Configuracion from "./Configuracion";

// --- IMPORTACIÓN DE IMÁGENES ---
import logoLetras from "./logo-asnc-letras.png";
import logoASNC from "./logo-asnc.png";
import logoSiglo from "./logo_siglo_cabecera.png"; // <--- Añadimos el nuevo logo
// --- IMPORTACIÓN DE FIREBASE ---
import { db } from "./firebase";
import { collection, onSnapshot, doc } from "firebase/firestore";

// --- VERCEL WEB ANALYTICS ---
import { Analytics } from "@vercel/analytics/react";

export default function App() {
  const [usuarioActual, setUsuarioActual] = useState(null);

  // --- LAS MEMORIAS AHORA ESTÁN VACÍAS POR DEFECTO ---
  const [listaAlmacenes, setListaAlmacenes] = useState([]);
  const [listaUsuarios, setListaUsuarios] = useState([]);
  const [listaArticulos, setListaArticulos] = useState([]);
  const [listaPedidos, setListaPedidos] = useState([]);

  const [cargando, setCargando] = useState(true); // Pantalla de carga inicial
  const [pantalla, setPantalla] = useState("pedidos");
  const [historialDeshacer, setHistorialDeshacer] = useState([]);

  // --- CAJONES DE LOGIN ---
  const [inputUsuario, setInputUsuario] = useState("");
  const [inputPassword, setInputPassword] = useState("");

  const colores = {
    verdePrincipal: "#008a45",
    verdeClaro: "#9acd32",
    naranjaSiglo: "#e67e22",
    fondoGris: "#f4f6f8",
  };
  // --- FUNCIÓN PARA ABRIR SIGLO ---
  const abrirSIGLO = () => {
    // Usamos la URL raíz y limpia. El servidor ya se encargará de crear una nueva sesión.
    const urlSiglo =
      "https://ws001.sspa.juntadeandalucia.es/logistica/organizacion/Login.jsf";

    // Abrimos una ventana emergente ("_blank") con un tamaño amplio para que parezca maximizada
    window.open(
      urlSiglo,
      "VentanaSIGLO",
      "width=1200,height=800,resizable=yes,scrollbars=yes,status=yes"
    );
  };
  // ==========================================
  // 📡 ANTENAS DE CONEXIÓN EN TIEMPO REAL
  // ==========================================
  useEffect(() => {
    // 1. Escuchar Usuarios
    const unsubUsuarios = onSnapshot(collection(db, "usuarios"), (snapshot) => {
      setListaUsuarios(snapshot.docs.map((d) => d.data()));
    });

    // 2. Escuchar Almacenes
    const unsubAlmacenes = onSnapshot(
      doc(db, "configuracion", "almacenes"),
      (documento) => {
        if (documento.exists()) setListaAlmacenes(documento.data().lista || []);
      }
    );

    // 3. Escuchar Catálogo
    const unsubCatalogo = onSnapshot(collection(db, "catalogo"), (snapshot) => {
      setListaArticulos(snapshot.docs.map((d) => d.data()));
    });

    // 4. Escuchar Pedidos (Cuando lleguen, quitamos la pantalla de carga)
    const unsubPedidos = onSnapshot(collection(db, "pedidos"), (snapshot) => {
      // 👇 HEMOS AÑADIDO EL ID AQUÍ 👇
      setListaPedidos(snapshot.docs.map((d) => ({ ...d.data(), id: d.id })));
      setCargando(false);
    });

    // Apagar las escuchas si cerramos la app
    return () => {
      unsubUsuarios();
      unsubAlmacenes();
      unsubCatalogo();
      unsubPedidos();
    };
  }, []);

  // --- FUNCIÓN DE LOGIN ---
  const iniciarSesion = (e) => {
    if (e) e.preventDefault();
    const user = inputUsuario.trim().toLowerCase();
    const pass = inputPassword.trim();

    // Ahora busca en la lista descargada de Firebase
    const usuarioEncontrado = listaUsuarios.find(
      (u) => u.user === user && u.pass === pass
    );

    if (usuarioEncontrado) {
      setUsuarioActual(usuarioEncontrado);
      setInputUsuario("");
      setInputPassword("");
    } else {
      alert("❌ Usuario o contraseña incorrectos.");
    }
  };

  const cerrarSesion = () => {
    setUsuarioActual(null);
    setPantalla("pedidos");
  };

  // --- FUNCIONES TEMPORALES (Las adaptaremos en el siguiente paso) ---
  const actualizarArticulos = (nuevaLista) => setListaArticulos(nuevaLista);
  const actualizarPedidos = (nuevaLista) => setListaPedidos(nuevaLista);
  const deshacerCambio = () =>
    alert("La función deshacer se actualizará para la nube pronto.");

  // ==========================================
  // PANTALLA 0: CARGANDO DATOS...
  // ==========================================
  if (cargando) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          backgroundColor: colores.fondoGris,
        }}
      >
        <img
          src={logoASNC}
          alt="ASNC"
          style={{
            width: "80px",
            marginBottom: "20px",
            animation: "pulse 1.5s infinite",
          }}
        />
        <h2 style={{ color: colores.verdePrincipal, fontFamily: "sans-serif" }}>
          Conectando con el hospital...
        </h2>
      </div>
    );
  }

  // ==========================================
  // PANTALLA 1: LOGIN CORPORATIVO
  // ==========================================
  if (!usuarioActual) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          backgroundColor: colores.fondoGris,
          fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif",
        }}
      >
        <div
          style={{
            backgroundColor: "white",
            padding: "40px",
            borderRadius: "8px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
            width: "100%",
            maxWidth: "420px",
            textAlign: "center",
            borderTop: `5px solid ${colores.verdePrincipal}`,
          }}
        >
          <img
            src={logoLetras}
            alt="Área Sanitaria Norte de Córdoba"
            style={{ maxWidth: "220px", marginBottom: "20px" }}
          />
          <h2 style={{ color: "#333", margin: "0 0 5px 0", fontSize: "22px" }}>
            Gestión Logística Local
          </h2>
          <p style={{ color: "#777", marginBottom: "30px", fontSize: "14px" }}>
            Control de Consumos y Almacenes
          </p>

          <form
            style={{ display: "flex", flexDirection: "column", gap: "18px" }}
          >
            <div style={{ textAlign: "left" }}>
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: "bold",
                  color: colores.verdePrincipal,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Credenciales corporativas
              </label>
              <input
                name="usuario"
                type="text"
                placeholder="Usuario (ej. admin o urg)"
                value={inputUsuario}
                onChange={(e) => setInputUsuario(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") iniciarSesion(e);
                }}
                required
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "4px",
                  border: "1px solid #d1d5da",
                  fontSize: "15px",
                  marginTop: "5px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <input
              name="password"
              type="password"
              placeholder="Contraseña"
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") iniciarSesion(e);
              }}
              required
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "4px",
                border: "1px solid #d1d5da",
                fontSize: "15px",
                boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              onClick={iniciarSesion}
              style={{
                padding: "14px",
                backgroundColor: colores.verdePrincipal,
                color: "white",
                border: "none",
                borderRadius: "4px",
                fontWeight: "bold",
                fontSize: "16px",
                cursor: "pointer",
                marginTop: "10px",
                transition: "background-color 0.3s",
              }}
            >
              Acceder al Sistema
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // PANTALLA 2: APLICACIÓN PRINCIPAL
  // ==========================================
  return (
    <>
      <Analytics />
      <div
        className="App"
        style={{
          padding: "20px",
          fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif",
          maxWidth: "98%",
          margin: "0 auto",
          backgroundColor: colores.fondoGris,
          minHeight: "100vh",
          boxSizing: "border-box",
        }}
      >
      {/* CABECERA CORPORATIVA DE USUARIO */}
      <div
        style={{
          maxWidth: "1000px",
          margin: "0 auto 20px auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "white",
          padding: "15px 25px",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          borderLeft: `6px solid ${colores.verdePrincipal}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          {/* --- NUEVO LOGO SIGLO (BOTÓN) --- */}
          <img
            src={logoSiglo}
            alt="Acceso a SIGLO"
            title="Abrir SIGLO en ventana nueva"
            onClick={abrirSIGLO}
            style={{
              height: "45px",
              cursor: "pointer",
              borderRadius: "4px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.15)", // Sutil efecto 3D
              transition: "transform 0.2s", // Transición suave
            }}
            onMouseOver={(e) => (e.target.style.transform = "scale(1.05)")}
            onMouseOut={(e) => (e.target.style.transform = "scale(1)")}
          />
          {/* ------------------------------- */}

          {/* Logo del hospital */}
          <img
            src={logoASNC}
            alt="ASNC"
            style={{ width: "45px", height: "45px", objectFit: "contain" }}
          />
          <div>
            <h1 style={{ color: "#333", margin: 0, fontSize: "20px" }}>
              Gestión Logística Local
            </h1>
            <span style={{ fontSize: "14px", color: "#666" }}>
              Perfil: <strong>{usuarioActual.nombre}</strong> | Nivel:{" "}
              <span
                style={{
                  color: colores.verdePrincipal,
                  fontWeight: "bold",
                  textTransform: "capitalize",
                }}
              >
                {usuarioActual.rol}
              </span>
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={cerrarSesion}
            style={{
              padding: "8px 15px",
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* EL PASILLO */}
      <div
        style={{
          display: "flex",
          marginBottom: "20px",
          borderRadius: "8px",
          overflow: "hidden",
          border: "1px solid #e1e4e8",
          maxWidth: "1000px",
          margin: "0 auto 20px auto",
          backgroundColor: "white",
        }}
      >
        <button
          style={{
            flex: 1,
            padding: "15px",
            backgroundColor:
              pantalla === "pedidos" ? colores.verdePrincipal : "white",
            color: pantalla === "pedidos" ? "white" : "#444",
            border: "none",
            borderRight: "1px solid #e1e4e8",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "15px",
            transition: "all 0.2s",
          }}
          onClick={() => setPantalla("pedidos")}
        >
          📋 Registro de Consumos
        </button>
        <button
          style={{
            flex: 1,
            padding: "15px",
            backgroundColor:
              pantalla === "catalogo" ? colores.verdePrincipal : "white",
            color: pantalla === "catalogo" ? "white" : "#444",
            border: "none",
            borderRight: "1px solid #e1e4e8",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "15px",
            transition: "all 0.2s",
          }}
          onClick={() => setPantalla("catalogo")}
        >
          📦 Catálogo ASNC
        </button>

        {usuarioActual.rol === "admin" && (
          <>
            <button
              style={{
                flex: 1,
                padding: "15px",
                backgroundColor:
                  pantalla === "dashboard" ? colores.verdePrincipal : "white",
                color: pantalla === "dashboard" ? "white" : "#444",
                border: "none",
                borderRight: "1px solid #e1e4e8",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "15px",
                transition: "all 0.2s",
              }}
              onClick={() => setPantalla("dashboard")}
            >
              📊 Análisis y Alertas
            </button>
            <button
              style={{
                flex: 1,
                padding: "15px",
                backgroundColor:
                  pantalla === "configuracion" ? "#343a40" : "white",
                color: pantalla === "configuracion" ? "white" : "#444",
                border: "none",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "15px",
                transition: "all 0.2s",
              }}
              onClick={() => setPantalla("configuracion")}
            >
              ⚙️ Configuración
            </button>
          </>
        )}
      </div>

      {/* LAS HABITACIONES */}
      {pantalla === "catalogo" && (
        <Catalogo
          listaArticulos={listaArticulos}
          setListaArticulos={actualizarArticulos}
          usuarioActual={usuarioActual}
          listaAlmacenes={listaAlmacenes}
        />
      )}
      {pantalla === "pedidos" && (
        <Historial
          articulos={listaArticulos}
          listaPedidos={listaPedidos}
          setListaPedidos={actualizarPedidos}
          usuarioActual={usuarioActual}
          listaAlmacenes={listaAlmacenes}
        />
      )}
      {pantalla === "configuracion" && usuarioActual.rol === "admin" && (
        <Configuracion
          listaAlmacenes={listaAlmacenes}
          setListaAlmacenes={setListaAlmacenes}
          listaUsuarios={listaUsuarios}
          setListaUsuarios={setListaUsuarios}
        />
      )}
      {pantalla === "dashboard" && usuarioActual.rol === "admin" && (
        <Dashboard articulos={listaArticulos} listaPedidos={listaPedidos} />
      )}
      </div>
    </>
  );
}
