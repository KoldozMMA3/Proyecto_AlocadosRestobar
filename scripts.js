let cart = [];

document.addEventListener("DOMContentLoaded", () => {
    actualizarCarritoUI();

    const carritoBtn = document.getElementById('carritoBtn');
    if (carritoBtn) {
        carritoBtn.addEventListener("click", abrirModalPago);
    }

    const medioPago = document.getElementById("medioPago");
    if (medioPago) {
        medioPago.addEventListener("change", mostrarVoucher);
    }

    const tipoEntrega = document.getElementById("tipoEntrega");
    if (tipoEntrega) {
        tipoEntrega.addEventListener("change", mostrarDireccion);
    }

    // CONEXIÓN CON EL BOTÓN "FINALIZAR PEDIDO" DEL MODAL
    const btnFinalizarPedido = document.querySelector("#modalPago .btn-success");
    if (btnFinalizarPedido) {
        btnFinalizarPedido.addEventListener("click", finalizarCompraWeb);
    }
});

function addToCart(nombre, precio) {
    cart.push({ nombre, precio });
    actualizarCarritoUI();
    mostrarItemsEnModal();
}

function actualizarCarritoUI() {
    const carritoBtn = document.getElementById("carritoBtn");
    if (!carritoBtn) return;

    let total = cart.reduce((sum, item) => sum + item.precio, 0);
    carritoBtn.innerText = `🛒 Ver Carrito (S/ ${total.toFixed(2)})`;
}

function abrirModalPago() {
    let total = cart.reduce((sum, item) => sum + item.precio, 0);
    if (total < 6) {
        alert("El mínimo de compra es S/ 6.00");
        return;
    }

    mostrarItemsEnModal();
    document.getElementById("totalFinal").innerText = `Total: S/ ${total.toFixed(2)}`;

    const modal = new bootstrap.Modal(document.getElementById("modalPago"));
    modal.show();
}

function mostrarItemsEnModal() {
    const listado = document.getElementById("detalleCarrito");
    if (!listado) return;

    listado.innerHTML = '';
    cart.forEach((item, index) => {
        const li = document.createElement("li");
        li.className = "list-group-item d-flex justify-content-between align-items-center";
        li.textContent = item.nombre;
        const precio = document.createElement("span");
        precio.className = "badge bg-primary rounded-pill";
        precio.textContent = `S/ ${item.precio.toFixed(2)}`;
        li.appendChild(precio);
        listado.appendChild(li);
    });
}

function mostrarVoucher() {
    const medioPago = document.getElementById("medioPago").value;
    const uploadVoucher = document.getElementById("uploadVoucher");
    if (medioPago === "Yape" || medioPago === "Plin") {
        uploadVoucher.style.display = "block";
    } else {
        uploadVoucher.style.display = "none";
    }
}

function mostrarDireccion() {
    const tipoEntrega = document.getElementById("tipoEntrega").value;
    const datosDelivery = document.getElementById("datosDelivery");
    const mensajeRecojo = document.getElementById("mensajeRecojo");

    if (tipoEntrega === "Delivery") {
        datosDelivery.style.display = "block";
        mensajeRecojo.style.display = "none";
    } else if (tipoEntrega === "Recojo en Tienda") {
        datosDelivery.style.display = "none";
        mensajeRecojo.style.display = "block";
    } else {
        datosDelivery.style.display = "none";
        mensajeRecojo.style.display = "none";
    }
}

// Elementos de la interfaz para autenticación
const inputEmail = document.getElementById('auth-email');
const inputPassword = document.getElementById('auth-password');
const btnLogin = document.getElementById('btn-login');
const btnRegistro = document.getElementById('btn-registro');
const mensajeUsuario = document.getElementById('mensaje-usuario');

function mostrarNotificacion(mensaje, esExito = false) {
    mensajeUsuario.innerText = mensaje;
    mensajeUsuario.style.display = 'block';
    mensajeUsuario.style.color = esExito ? '#28a745' : '#dc3545';
}

// 1. PETICIÓN ASÍNCRONA PARA REGISTRO DE USUARIOS
btnRegistro.addEventListener('click', async () => {
    const email = inputEmail.value;
    const password = inputPassword.value;

    if (!email || !password) {
        mostrarNotificacion('Por favor, completa todos los campos.');
        return;
    }

    try {
        const respuesta = await fetch('http://localhost:3000/api/registro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await respuesta.json();

        if (!respuesta.ok) {
            mostrarNotificacion(data.error || 'No se pudo completar el registro.');
            return;
        }

        mostrarNotificacion('¡Registro exitoso! Ahora puedes iniciar sesión.', true);
        inputPassword.value = ''; 

    } catch (error) {
        console.error('Error de red:', error);
        mostrarNotificacion('No hay conexión con el servidor. Inténtalo más tarde.');
    }
});

// 2. PETICIÓN ASÍNCRONA PARA INICIAR SESIÓN (Obtención de JWT)
btnLogin.addEventListener('click', async () => {
    const email = inputEmail.value;
    const password = inputPassword.value;

    if (!email || !password) {
        mostrarNotificacion('Ingresa tus credenciales completas.');
        return;
    }

    try {
        const respuesta = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await respuesta.json();

        if (!respuesta.ok) {
            mostrarNotificacion(data.error || 'Credenciales incorrectas.');
            return;
        }

        localStorage.setItem('token_alocados', data.token);
        mostrarNotificacion(`¡Bienvenido, ${data.usuario.email}! Sesión iniciada correctamente.`, true);
        
    } catch (error) {
        console.error('Error de red:', error);
        mostrarNotificacion('Error de red al intentar conectar con el servidor.');
    }
});

// 3. ENVIAR LA COMPRA AL BACKEND (Transactional Outbox + Validación de JWT)
async function finalizarCompraWeb() {
    const token = localStorage.getItem('token_alocados');

    if (!token) {
        alert('Debes iniciar sesión con tu cuenta para poder finalizar el pedido.');
        return;
    }

    // Calculamos el total y mapeamos los nombres de los productos del carrito actual
    let totalCompra = cart.reduce((sum, item) => sum + item.precio, 0);
    let nombresProductos = cart.map(item => item.nombre);

    try {
        const respuesta = await fetch('http://localhost:3000/api/comprar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Formato Bearer Token
            },
            body: JSON.stringify({
                total: totalCompra,
                items: nombresProductos
            })
        });

        const data = await respuesta.json();

        if (!respuesta.ok) {
            alert(data.error || 'Ocurrió un problema al procesar la transacción.');
            return;
        }

        // Notificación de éxito en pantalla
        alert(`¡Pedido #${data.pedidoId} realizado con éxito! Tu orden ha sido registrada en el sistema.`);
        
        // Limpiamos el carrito e interfaz tras la venta exitosa
        cart = [];
        actualizarCarritoUI();

        // Cerramos el modal de Bootstrap automáticamente
        const modalElemento = document.getElementById('modalPago');
        const modalInstancia = bootstrap.Modal.getInstance(modalElemento);
        if (modalInstancia) {
            modalInstancia.hide();
        }

    } catch (error) {
        console.error('Error enviando la compra:', error);
        alert('Error de red al intentar conectar con el servidor backend.');
    }
}