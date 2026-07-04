import React, { useState } from "react";

export default function Configuracion({
  listaAlmacenes,
  setListaAlmacenes,
  listaUsuarios,
  setListaUsuarios,
}) {
  const [nuevoAlmacen, setNuevoAlmacen] = useState("");

  // --- ESTADOS PARA FORMULARIO DE USUARIOS ---
  const [nuevoUsuario, setNuevoUsuario] = useState("");
  const [nuevoPassword, setNuevoPassword] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoRol, setNuevoRol] = useState("gestor");
  const [almacenesUsuario, setAlmacenesUsuario] = useState([]);

  // NUEVA MEMORIA: Para saber si estamos editando y a quién
  const [editandoUsuario, setEditandoUsuario] = useState(null);

  // --- FUNCIONES PARA ALMACENES ---
  const agregarAlmacen = () => {
    const almacenLimpio = nuevoAlmacen.trim();
    if (almacenLimpio !== "") {
      const yaExiste = listaAlmacenes.some(
        (a) => a.toLowerCase() === almacenLimpio.toLowerCase()
      );
      if (!yaExiste) {
        setListaAlmacenes([...listaAlmacenes, almacenLimpio]);
        setNuevoAlmacen("");
      } else {
        alert("⚠️ Ese almacén ya existe en la lista.");
      }
    }
  };

  const borrarAlmacen = (almacen) => {
    if (
      window.confirm(`⚠️ ¿Seguro que quieres borrar el almacén ${almacen}?`)
    ) {
      setListaAlmacenes(listaAlmacenes.filter((a) => a !== almacen));
    }
  };

  // --- FUNCIONES PARA USUARIOS ---
  const toggleAlmacenUsuario = (alm) => {
    if (almacenesUsuario.includes(alm)) {
      setAlmacenesUsuario(almacenesUsuario.filter((a) => a !== alm));
    } else {
      setAlmacenesUsuario([...almacenesUsuario, alm]);
    }
  };

  const limpiarFormularioUsuario = () => {
    setNuevoUsuario("");
    setNuevoPassword("");
    setNuevoNombre("");
    setNuevoRol("gestor");
    setAlmacenesUsuario([]);
    setEditandoUsuario(null);
  };

  const agregarUsuario = (e) => {
    e.preventDefault();
    const userLimpio = nuevoUsuario.trim().toLowerCase();

    // Si estamos editando al admin principal, no le dejamos cambiar su 'login'
    if (editandoUsuario === "admin" && userLimpio !== "admin") {
      alert(
        "⚠️ Por seguridad, no se puede cambiar el nombre de usuario (login) del administrador principal."
      );
      return;
    }

    // Comprobamos si el nombre de usuario ya existe (SOLO si es uno nuevo, o si se lo hemos cambiado a uno existente)
    if (
      listaUsuarios.some((u) => u.user === userLimpio) &&
      (!editandoUsuario || editandoUsuario !== userLimpio)
    ) {
      alert("⚠️ Ese nombre de usuario (login) ya existe.");
      return;
    }

    const almacenesAsignados =
      nuevoRol === "admin" ? ["TODOS"] : almacenesUsuario;

    if (nuevoRol === "gestor" && almacenesAsignados.length === 0) {
      alert("⚠️ Un gestor debe tener al menos un almacén asignado.");
      return;
    }

    const nuevoObj = {
      user: userLimpio,
      pass: nuevoPassword.trim(),
      nombre: nuevoNombre.trim(),
      rol: nuevoRol,
      almacenes: almacenesAsignados,
    };

    if (editandoUsuario) {
      // MODO EDICIÓN: Sustituimos el usuario antiguo por el actualizado
      const nuevaLista = listaUsuarios.map((u) =>
        u.user === editandoUsuario ? nuevoObj : u
      );
      setListaUsuarios(nuevaLista);
    } else {
      // MODO CREACIÓN: Añadimos uno nuevo
      setListaUsuarios([...listaUsuarios, nuevoObj]);
    }

    limpiarFormularioUsuario();
  };

  const iniciarEdicion = (usr) => {
    setNuevoNombre(usr.nombre);
    setNuevoUsuario(usr.user);
    setNuevoPassword(usr.pass);
    setNuevoRol(usr.rol);
    setAlmacenesUsuario([...usr.almacenes]);
    setEditandoUsuario(usr.user); // Guardamos su DNI para saber a quién machacar luego
  };

  const duplicarUsuario = (usr) => {
    setNuevoNombre(usr.nombre + " (Copia)");
    setNuevoUsuario(usr.user + "_copia");
    setNuevoPassword(usr.pass);
    setNuevoRol(usr.rol);
    setAlmacenesUsuario([...usr.almacenes]);
    setEditandoUsuario(null); // Es un registro nuevo, NO una edición
  };

  const borrarUsuario = (userABorrar) => {
    if (userABorrar === "admin") {
      alert("❌ Por seguridad, el administrador principal no se puede borrar.");
      return;
    }
    if (
      window.confirm(`⚠️ ¿Seguro que quieres borrar al usuario ${userABorrar}?`)
    ) {
      setListaUsuarios(listaUsuarios.filter((u) => u.user !== userABorrar));
      // Si justo estaba editando a ese usuario, le limpiamos la pantalla
      if (editandoUsuario === userABorrar) limpiarFormularioUsuario();
    }
  };

  // --- ESTILOS ---
  const estiloTarjeta = {
    backgroundColor: "white",
    padding: "20px",
    borderRadius: "8px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    marginBottom: "20px",
    borderTop: "4px solid #343a40",
  };

  const estiloInput = {
    width: "100%",
    padding: "8px",
    borderRadius: "4px",
    border: "1px solid #ccc",
    boxSizing: "border-box",
    marginBottom: "10px",
  };

  return (
    <div style={{ width: "100%", boxSizing: "border-box" }}>
      <h2
        style={{
          color: "#333",
          marginTop: 0,
          borderBottom: "2px solid #343a40",
          paddingBottom: "10px",
          marginBottom: "25px",
        }}
      >
        ⚙️ Panel de Administración y Configuración
      </h2>

      <div
        style={{
          display: "flex",
          gap: "20px",
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        {/* MÓDULO 1: GESTIÓN DE ALMACENES */}
        <div style={{ ...estiloTarjeta, flex: 1, minWidth: "300px" }}>
          <h3 style={{ marginTop: 0, color: "#343a40" }}>
            🏢 Gestión de Almacenes
          </h3>
          <p style={{ fontSize: "13px", color: "#666" }}>
            Añade o elimina almacenes. Aparecerán en los desplegables de pedidos
            y catálogo.
          </p>

          <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
            <input
              type="text"
              placeholder="Nombre del nuevo almacén..."
              value={nuevoAlmacen}
              onChange={(e) => setNuevoAlmacen(e.target.value)}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "4px",
                border: "1px solid #ccc",
              }}
            />
            <button
              onClick={agregarAlmacen}
              style={{
                padding: "8px 15px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Añadir
            </button>
          </div>

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "14px",
            }}
          >
            <tbody>
              {listaAlmacenes.map((almacen, index) => (
                <tr key={index} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "10px", fontWeight: "bold" }}>
                    {almacen}
                  </td>
                  <td style={{ padding: "10px", textAlign: "right" }}>
                    <button
                      onClick={() => borrarAlmacen(almacen)}
                      style={{
                        padding: "4px 8px",
                        backgroundColor: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* MÓDULO 2: FORMULARIO DE USUARIO (CREAR / EDITAR) */}
        <div
          style={{
            ...estiloTarjeta,
            flex: 1,
            minWidth: "300px",
            borderTop: editandoUsuario
              ? "4px solid #ffc107"
              : "4px solid #343a40",
          }}
        >
          <h3
            style={{
              marginTop: 0,
              color: editandoUsuario ? "#856404" : "#343a40",
            }}
          >
            {editandoUsuario
              ? `✏️ Editando: ${editandoUsuario}`
              : "➕ Nuevo Perfil"}
          </h3>

          <form onSubmit={agregarUsuario}>
            <label
              style={{ fontSize: "12px", fontWeight: "bold", color: "#555" }}
            >
              Nombre Real:
            </label>
            <input
              type="text"
              placeholder="Ej: Juan Pérez"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              required
              style={estiloInput}
            />

            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    fontSize: "12px",
                    fontWeight: "bold",
                    color: "#555",
                  }}
                >
                  Usuario (Login):
                </label>
                <input
                  type="text"
                  placeholder="Ej: juan.p"
                  value={nuevoUsuario}
                  onChange={(e) => setNuevoUsuario(e.target.value)}
                  required
                  style={{
                    ...estiloInput,
                    backgroundColor:
                      editandoUsuario === "admin" ? "#e9ecef" : "white",
                  }}
                  disabled={editandoUsuario === "admin"}
                  title={
                    editandoUsuario === "admin"
                      ? "El login del admin no se puede cambiar"
                      : ""
                  }
                />
              </div>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    fontSize: "12px",
                    fontWeight: "bold",
                    color: "#555",
                  }}
                >
                  Contraseña:
                </label>
                <input
                  type="text"
                  placeholder="Clave..."
                  value={nuevoPassword}
                  onChange={(e) => setNuevoPassword(e.target.value)}
                  required
                  style={estiloInput}
                />
              </div>
            </div>

            <label
              style={{ fontSize: "12px", fontWeight: "bold", color: "#555" }}
            >
              Nivel de Acceso:
            </label>
            <select
              value={nuevoRol}
              onChange={(e) => setNuevoRol(e.target.value)}
              style={estiloInput}
            >
              <option value="gestor">Gestor Local (Acceso limitado)</option>
              <option value="admin">Administrador (Acceso total)</option>
            </select>

            {nuevoRol === "gestor" && (
              <div
                style={{
                  backgroundColor: "#f8f9fa",
                  padding: "10px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                  marginBottom: "10px",
                }}
              >
                <label
                  style={{
                    fontSize: "12px",
                    fontWeight: "bold",
                    color: "#555",
                    display: "block",
                    marginBottom: "5px",
                  }}
                >
                  Almacenes Asignados:
                </label>
                {listaAlmacenes.map((alm, index) => (
                  <label
                    key={index}
                    style={{
                      display: "block",
                      fontSize: "13px",
                      marginBottom: "4px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={almacenesUsuario.includes(alm)}
                      onChange={() => toggleAlmacenUsuario(alm)}
                      style={{ marginRight: "8px" }}
                    />
                    {alm}
                  </label>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              {editandoUsuario && (
                <button
                  type="button"
                  onClick={limpiarFormularioUsuario}
                  style={{
                    flex: 1,
                    padding: "10px",
                    backgroundColor: "#6c757d",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                style={{
                  flex: 2,
                  padding: "10px",
                  backgroundColor: editandoUsuario ? "#ffc107" : "#0056b3",
                  color: editandoUsuario ? "#333" : "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                {editandoUsuario ? "💾 Guardar Cambios" : "💾 Crear Usuario"}
              </button>
            </div>
          </form>
        </div>

        {/* MÓDULO 3: LISTA DE USUARIOS */}
        <div style={{ ...estiloTarjeta, width: "100%" }}>
          <h3 style={{ marginTop: 0, color: "#343a40" }}>
            👥 Usuarios Activos
          </h3>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "13px",
              textAlign: "left",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f8f9fa" }}>
                <th
                  style={{
                    padding: "10px",
                    borderBottom: "2px solid #ddd",
                    width: "15%",
                  }}
                >
                  Usuario
                </th>
                <th
                  style={{
                    padding: "10px",
                    borderBottom: "2px solid #ddd",
                    width: "15%",
                  }}
                >
                  Contraseña
                </th>
                <th
                  style={{
                    padding: "10px",
                    borderBottom: "2px solid #ddd",
                    width: "20%",
                  }}
                >
                  Nombre
                </th>
                <th
                  style={{
                    padding: "10px",
                    borderBottom: "2px solid #ddd",
                    width: "10%",
                  }}
                >
                  Rol
                </th>
                <th
                  style={{
                    padding: "10px",
                    borderBottom: "2px solid #ddd",
                    width: "25%",
                  }}
                >
                  Almacenes Asignados
                </th>
                <th
                  style={{
                    padding: "10px",
                    borderBottom: "2px solid #ddd",
                    textAlign: "center",
                    width: "15%",
                  }}
                >
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {listaUsuarios.map((usr, index) => (
                <tr
                  key={index}
                  style={{
                    borderBottom: "1px solid #eee",
                    backgroundColor:
                      editandoUsuario === usr.user ? "#fff8b0" : "transparent",
                  }}
                >
                  <td style={{ padding: "10px", fontWeight: "bold" }}>
                    {usr.user}
                  </td>
                  <td
                    style={{
                      padding: "10px",
                      color: "#999",
                      fontStyle: "italic",
                    }}
                  >
                    {usr.pass}
                  </td>
                  <td style={{ padding: "10px" }}>{usr.nombre}</td>
                  <td style={{ padding: "10px" }}>
                    <span
                      style={{
                        backgroundColor:
                          usr.rol === "admin" ? "#007bff" : "#17a2b8",
                        color: "white",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        textTransform: "uppercase",
                        fontWeight: "bold",
                      }}
                    >
                      {usr.rol}
                    </span>
                  </td>
                  <td style={{ padding: "10px", color: "#555" }}>
                    {usr.almacenes.join(", ")}
                  </td>
                  <td style={{ padding: "10px" }}>
                    <div
                      style={{
                        display: "flex",
                        gap: "5px",
                        justifyContent: "center",
                      }}
                    >
                      <button
                        onClick={() => duplicarUsuario(usr)}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "#6c757d",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                        title="Duplicar"
                      >
                        📋
                      </button>
                      <button
                        onClick={() => iniciarEdicion(usr)}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "#ffc107",
                          color: "#333",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => borrarUsuario(usr.user)}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "#dc3545",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          opacity: usr.user === "admin" ? 0.3 : 1,
                        }}
                        disabled={usr.user === "admin"}
                        title={
                          usr.user === "admin"
                            ? "No se puede borrar al admin"
                            : "Borrar usuario"
                        }
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
