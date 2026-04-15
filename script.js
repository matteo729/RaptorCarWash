// ============================================
// RAPTOR CAR WASH - LÓGICA PRINCIPAL
// ============================================

// Configuración de Supabase (CAMBIAR ESTOS VALORES)
const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'TU_ANON_KEY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// VARIABLES GLOBALES
// ============================================
let currentUser = null;
let gananciasChart = null;

// ============================================
// FUNCIONES DE AUTENTICACIÓN
// ============================================
async function checkSession() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

async function logout() {
    await supabase.auth.signOut();
    window.location.reload();
}

// ============================================
// FUNCIONES DE ADMIN (solo para admin.html)
// ============================================

// Verificar si el usuario es admin
async function isAdmin() {
    const user = await checkSession();
    if (!user) return false;
    const { data } = await supabase.from('perfiles').select('rol').eq('id', user.id).single();
    return data?.rol === 'admin';
}

// Cargar estadísticas generales
async function loadEstadisticasGenerales() {
    const { data: lavados } = await supabase.from('lavados').select('precio_final, comision_ganada');
    const { data: gastos } = await supabase.from('gastos').select('monto');
    
    const ingresos = lavados?.reduce((s, l) => s + l.precio_final, 0) || 0;
    const comisiones = lavados?.reduce((s, l) => s + l.comision_ganada, 0) || 0;
    const gastosTotal = gastos?.reduce((s, g) => s + g.monto, 0) || 0;
    const ganancia = ingresos - comisiones - gastosTotal;
    
    document.getElementById('totalIngresos') && (document.getElementById('totalIngresos').innerText = `$${ingresos.toFixed(2)}`);
    document.getElementById('totalGastos') && (document.getElementById('totalGastos').innerText = `$${gastosTotal.toFixed(2)}`);
    document.getElementById('gananciaNeta') && (document.getElementById('gananciaNeta').innerText = `$${ganancia.toFixed(2)}`);
    document.getElementById('totalComisiones') && (document.getElementById('totalComisiones').innerText = `$${comisiones.toFixed(2)}`);
    
    const gananciaElement = document.getElementById('gananciaNeta');
    if (gananciaElement) {
        if (ganancia >= 0) {
            gananciaElement.className = 'stat-value positive';
        } else {
            gananciaElement.className = 'stat-value negative';
        }
    }
}

// Cargar gráfico de ganancias por empleado
async function loadGraficoGanancias() {
    const { data: empleados } = await supabase.from('perfiles').select('id, nombre').eq('rol', 'empleado');
    const labels = [];
    const dataGanancias = [];
    
    for (let emp of empleados) {
        const { data: lavados } = await supabase.from('lavados')
            .select('precio_final')
            .eq('empleado_id', emp.id);
        const total = lavados?.reduce((s, l) => s + l.precio_final, 0) || 0;
        labels.push(emp.nombre.split(' ')[0]);
        dataGanancias.push(total);
    }
    
    const ctx = document.getElementById('gananciasChart')?.getContext('2d');
    if (!ctx) return;
    
    if (gananciasChart) gananciasChart.destroy();
    
    gananciasChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ganancias por empleado ($)',
                data: dataGanancias,
                backgroundColor: '#ef4444',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { labels: { color: '#e0e0e0' } }
            },
            scales: {
                y: { ticks: { color: '#e0e0e0' }, grid: { color: '#3f3f3f' } },
                x: { ticks: { color: '#e0e0e0' }, grid: { color: '#3f3f3f' } }
            }
        }
    });
}

// Cargar empleados
async function loadEmpleados() {
    const { data } = await supabase.from('perfiles').select('*').eq('rol', 'empleado');
    const container = document.getElementById('empleadosList');
    if (!container) return;
    
    container.innerHTML = '';
    data?.forEach(emp => {
        container.innerHTML += `
            <div class="empleado-item">
                <div class="empleado-info">
                    <div class="empleado-nombre">${emp.nombre}</div>
                    <div class="empleado-email">${emp.email}</div>
                </div>
                <button class="btn-small" onclick="window.eliminarEmpleado('${emp.id}')">Eliminar</button>
            </div>
        `;
    });
}

// Eliminar empleado (se expone globalmente)
window.eliminarEmpleado = async (id) => {
    if (confirm('¿Eliminar empleado? Se eliminarán todos sus lavados.')) {
        await supabase.from('perfiles').delete().eq('id', id);
        loadEmpleados();
        loadReporteEmpleados();
        loadEstadisticasGenerales();
        loadGraficoGanancias();
    }
};

// Crear empleado
async function crearEmpleado(nombre, email, password) {
    const { data: { user }, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    await supabase.from('perfiles').insert([{ id: user.id, nombre, email, rol: 'empleado' }]);
}

// Cargar tipos de lavado
async function loadTipos() {
    const { data } = await supabase.from('tipos_lavado').select('*').order('id');
    const container = document.getElementById('tiposList');
    if (!container) return;
    
    container.innerHTML = '';
    data?.forEach(t => {
        container.innerHTML += `
            <div class="tipo-item">
                <div>
                    <strong>${t.nombre}</strong> (${t.tipo_vehiculo})<br>
                    💰 $${t.precio_total} | 🧾 Comisión: $${t.comision_empleado}
                </div>
                <button class="btn-small" onclick="window.eliminarTipo(${t.id})">Eliminar</button>
            </div>
        `;
    });
}

// Eliminar tipo de lavado
window.eliminarTipo = async (id) => {
    if (confirm('¿Eliminar tipo de lavado?')) {
        await supabase.from('tipos_lavado').delete().eq('id', id);
        loadTipos();
    }
};

// Crear tipo de lavado
async function crearTipoLavado(nombre, tipo_vehiculo, precio_total, comision_empleado) {
    await supabase.from('tipos_lavado').insert([{ nombre, tipo_vehiculo, precio_total, comision_empleado }]);
}

// Cargar gastos con filtros
async function loadGastos(filtros = {}) {
    let query = supabase.from('gastos').select('*').order('fecha', { ascending: false });
    
    if (filtros.fechaInicio) query = query.gte('fecha', filtros.fechaInicio);
    if (filtros.fechaFin) query = query.lte('fecha', filtros.fechaFin);
    if (filtros.categoria && filtros.categoria !== '') query = query.eq('categoria', filtros.categoria);
    
    const { data } = await query;
    const container = document.getElementById('gastosList');
    if (!container) return;
    
    container.innerHTML = '';
    let total = 0;
    data?.forEach(g => {
        total += g.monto;
        container.innerHTML += `
            <div class="gasto-item">
                <div class="gasto-info">
                    <div class="gasto-concepto">${g.concepto}</div>
                    <div class="gasto-categoria">${g.categoria}</div>
                    <div class="badge">${new Date(g.fecha).toLocaleDateString()}</div>
                </div>
                <div class="gasto-monto">$${g.monto.toFixed(2)}</div>
                <button class="btn-small" onclick="window.eliminarGasto(${g.id})">🗑️</button>
            </div>
        `;
    });
    
    const totalContainer = document.getElementById('totalGastosFiltrados');
    if (totalContainer) totalContainer.innerHTML = `<strong>Total filtrado: $${total.toFixed(2)}</strong>`;
}

// Eliminar gasto
window.eliminarGasto = async (id) => {
    if (confirm('¿Eliminar este gasto?')) {
        await supabase.from('gastos').delete().eq('id', id);
        aplicarFiltrosGastos();
        loadEstadisticasGenerales();
    }
};

// Crear gasto
async function crearGasto(concepto, categoria, monto, fecha) {
    await supabase.from('gastos').insert([{ concepto, categoria, monto, fecha }]);
}

// Aplicar filtros de gastos
function aplicarFiltrosGastos() {
    const filtros = {
        fechaInicio: document.getElementById('filtroFechaInicio')?.value,
        fechaFin: document.getElementById('filtroFechaFin')?.value,
        categoria: document.getElementById('filtroCategoria')?.value
    };
    loadGastos(filtros);
}

// Cargar reporte de empleados
async function loadReporteEmpleados() {
    const { data: empleados } = await supabase.from('perfiles').select('id, nombre').eq('rol', 'empleado');
    const container = document.getElementById('reporteEmpleados');
    if (!container) return;
    
    container.innerHTML = '';
    
    for (let emp of empleados) {
        const { data: lavados } = await supabase.from('lavados')
            .select('precio_final, comision_ganada')
            .eq('empleado_id', emp.id);
        const totalRecaudado = lavados?.reduce((s, l) => s + l.precio_final, 0) || 0;
        const totalComisiones = lavados?.reduce((s, l) => s + l.comision_ganada, 0) || 0;
        const ganancia = totalRecaudado - totalComisiones;
        
        container.innerHTML += `
            <div class="reporte-item">
                <strong>${emp.nombre}</strong><br>
                💰 Recaudado: $${totalRecaudado.toFixed(2)}<br>
                🧾 Comisiones: $${totalComisiones.toFixed(2)}<br>
                📈 Ganancia local: $${ganancia.toFixed(2)}
            </div>
        `;
    }
}

// Cargar estadísticas mensuales
async function loadEstadisticasMensuales() {
    const { data } = await supabase.from('estadisticas_mensuales').select('*').limit(6);
    const container = document.getElementById('estadisticasMensuales');
    if (!container) return;
    
    container.innerHTML = '';
    
    data?.forEach(est => {
        const mes = new Date(est.mes).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        container.innerHTML += `
            <div class="reporte-item">
                <strong>📅 ${mes}</strong><br>
                🚗 Lavados: ${est.total_lavados}<br>
                💰 Ingresos: $${est.ingresos_brutos.toFixed(2)}<br>
                💸 Gastos: $${est.total_gastos.toFixed(2)}<br>
                📈 Ganancia Neta: <span class="${est.ganancia_neta >= 0 ? 'positive' : 'negative'}">$${est.ganancia_neta.toFixed(2)}</span>
            </div>
        `;
    });
}

// ============================================
// FUNCIONES DE EMPLEADO (solo para empleado.html)
// ============================================

// Cargar tipos de lavado para empleado
async function loadTiposEmpleado() {
    const { data } = await supabase.from('tipos_lavado').select('*');
    const select = document.getElementById('tipoLavado');
    if (!select) return;
    
    select.innerHTML = '';
    data?.forEach(t => {
        const option = document.createElement('option');
        option.value = t.id;
        option.textContent = `${t.nombre} (${t.tipo_vehiculo}) - $${t.precio_total}`;
        option.dataset.precio = t.precio_total;
        option.dataset.comision = t.comision_empleado;
        select.appendChild(option);
    });
    actualizarPrecioYComision();
}

// Actualizar precio y comisión al seleccionar tipo
function actualizarPrecioYComision() {
    const select = document.getElementById('tipoLavado');
    if (!select) return;
    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption) {
        const precioSpan = document.getElementById('precioFinalMostrado');
        const comisionSpan = document.getElementById('comisionMostrada');
        if (precioSpan) precioSpan.innerText = selectedOption.dataset.precio;
        if (comisionSpan) comisionSpan.innerText = selectedOption.dataset.comision;
    }
}

// Cargar historial de lavados del empleado
async function loadHistorialEmpleado(empleadoId) {
    const { data } = await supabase.from('lavados')
        .select(`id, matricula, observaciones, precio_final, comision_ganada, created_at, tipos_lavado(nombre)`)
        .eq('empleado_id', empleadoId)
        .order('created_at', { ascending: false });
    
    const container = document.getElementById('historialLavados');
    if (!container) return;
    
    container.innerHTML = '';
    data?.forEach(l => {
        container.innerHTML += `
            <div class="lavado-item">
                <div><strong>${l.tipos_lavado.nombre}</strong> - $${l.precio_final}</div>
                <div class="badge">${l.matricula}</div>
                <div class="badge">Comisión: $${l.comision_ganada}</div>
                <div class="badge">${new Date(l.created_at).toLocaleString()}</div>
                ${l.observaciones ? `<div class="badge">📝 ${l.observaciones}</div>` : ''}
            </div>
        `;
    });
}

// Registrar nuevo lavado
async function registrarLavado(empleadoId, tipoLavadoId, matricula, observaciones, precioFinal, comisionGanada) {
    const { error } = await supabase.from('lavados').insert([{
        empleado_id: empleadoId,
        tipo_lavado_id: tipoLavadoId,
        matricula,
        observaciones,
        precio_final: precioFinal,
        comision_ganada: comisionGanada
    }]);
    if (error) throw error;
}

// Cargar estadísticas personales del empleado
async function loadMisEstadisticas(empleadoId) {
    const { data: lavados } = await supabase.from('lavados')
        .select('precio_final, comision_ganada')
        .eq('empleado_id', empleadoId);
    
    const total = lavados?.reduce((s, l) => s + l.precio_final, 0) || 0;
    const comisiones = lavados?.reduce((s, l) => s + l.comision_ganada, 0) || 0;
    const cantidad = lavados?.length || 0;
    
    const totalElement = document.getElementById('miTotalRecaudado');
    const comisionesElement = document.getElementById('misComisiones');
    const cantidadElement = document.getElementById('misLavados');
    
    if (totalElement) totalElement.innerText = `$${total.toFixed(2)}`;
    if (comisionesElement) comisionesElement.innerText = `$${comisiones.toFixed(2)}`;
    if (cantidadElement) cantidadElement.innerText = cantidad;
}

// ============================================
// EXPORTAR FUNCIONES GLOBALES (para usar en HTML)
// ============================================
window.supabaseClient = supabase;
window.checkSession = checkSession;
window.login = login;
window.logout = logout;
window.isAdmin = isAdmin;
window.loadEstadisticasGenerales = loadEstadisticasGenerales;
window.loadGraficoGanancias = loadGraficoGanancias;
window.loadEmpleados = loadEmpleados;
window.crearEmpleado = crearEmpleado;
window.loadTipos = loadTipos;
window.crearTipoLavado = crearTipoLavado;
window.loadGastos = loadGastos;
window.crearGasto = crearGasto;
window.aplicarFiltrosGastos = aplicarFiltrosGastos;
window.loadReporteEmpleados = loadReporteEmpleados;
window.loadEstadisticasMensuales = loadEstadisticasMensuales;
window.loadTiposEmpleado = loadTiposEmpleado;
window.actualizarPrecioYComision = actualizarPrecioYComision;
window.loadHistorialEmpleado = loadHistorialEmpleado;
window.registrarLavado = registrarLavado;
window.loadMisEstadisticas = loadMisEstadisticas;