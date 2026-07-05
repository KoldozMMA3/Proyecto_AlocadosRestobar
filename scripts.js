
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

