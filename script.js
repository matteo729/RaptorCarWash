// script.js
// ==================== CONFIGURACIÓN ====================
// NOTA: Asegúrate de que config.js esté cargado antes que este script

// Variables globales
let currentUser = null;
let currentEmpleado = null;
let gananciasChart = null;

// ==================== UTILIDADES ====================

// Mostrar mensaje de error temporal
function showError(message, elementId = null) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
        background: #f8d7da;
        color: #721c24;
        padding: 10px;
        border-radius: 6px;
        margin-bottom: 10px;
        border: 1px solid #f5c6cb;
        animation: slideIn 0.3s ease;
    `;
    
    if (elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.insertBefore(errorDiv, element.firstChild);
        } else {
            document.body.insertBefore(errorDiv, document.body.firstChild);
        }
    } else {
        document.body.insertBefore(errorDiv, document.body.firstChild);
    }
    
    setTimeout(() => {
        if (errorDiv && errorDiv.remove) {
            errorDiv.remove();
        }
    }, 3000);
}

// Mostrar mensaje de éxito
function showSuccess(message, elementId = null) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    successDiv.style.cssText = `
        background: #d4edda;
        color: #155724;
        padding: 10px;
        border-radius: 6px;
        margin-bottom: 10px;
        border: 1px solid #c3e6cb;
        animation: slideIn 0.3s ease;
    `;
    
    if (elementId && document.getElementById(elementId)) {
        document.getElementById(elementId).insertBefore(successDiv, document.getElementById(elementId).firstChild);
    } else {
        document.body.insertBefore(successDiv, document.body.firstChild);
    }
    
    setTimeout(() => {
        if (successDiv && successDiv.remove) {
            successDiv.remove();
        }
    }, 3000);
}

// Formatear fecha
function formatDate(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ==================== AUTENTICACIÓN ====================

// Verificar sesión actual
async function checkAuth() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
            console.error('Error de autenticación:', error);
            window.location.href = 'login.html';
            return false;
        }
        
        currentUser = session.user;
        console.log('Usuario autenticado:', currentUser.email);
        
        // Verificar si es admin o empleado según la página actual
        const isAdminPage = window.location.pathname.includes('admin.html');
        
        if (isAdminPage) {
            // Verificar si el usuario es admin (no está en tabla empleados)
            const { data: empleado, error: empError } = await supabase
                .from('empleados')
                .select('*')
                .eq('user_id', currentUser.id)
                .single();
            
            // Si existe en empleados, es empleado, redirigir
            if (!empError && empleado) {
                console.log('Usuario es empleado, redirigiendo...');
                window.location.href = 'empleados.html';
                return false;
            }
        } else if (window.location.pathname.includes('empleados.html')) {
            // En empleados.html, verificar que sea empleado
            const { data: empleado, error: empError } = await supabase
                .from('empleados')
                .select('*')
                .eq('user_id', currentUser.id)
                .single();
            
            if (empError || !empleado) {
                showError('No tienes permisos de empleado');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
                return false;
            }
            
            currentEmpleado = empleado;
            console.log('Empleado autenticado:', currentEmpleado.nombre);
        }
        
        return true;
        
    } catch (error) {
        console.error('Error en checkAuth:', error);
        showError('Error de autenticación. Por favor, inicia sesión nuevamente.');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        return false;
    }
}

// Cerrar sesión
async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        showError('Error al cerrar sesión');
    }
}

// ==================== ADMINISTRACIÓN ====================

// Cargar dashboard con estadísticas
async function loadDashboard() {
    try {
        const fechaInicio = new Date();
        fechaInicio.setDate(1); // Primer día del mes actual
        fechaInicio.setHours(0, 0, 0, 0);
        const fechaFin = new Date();
        fechaFin.setHours(23, 59, 59, 999);
        
        // Obtener lavados del mes
        const { data: lavados, error: lavadosError } = await supabase
            .from('lavados')
            .select('*')
            .gte('fecha', fechaInicio.toISOString())
            .lte('fecha', fechaFin.toISOString());
        
        if (lavadosError) throw lavadosError;
        
        // Obtener gastos del mes
        const { data: gastos, error: gastosError } = await supabase
            .from('gastos')
            .select('*')
            .gte('fecha', fechaInicio.toISOString())
            .lte('fecha', fechaFin.toISOString());
        
        if (gastosError) throw gastosError;
        
        const ganancias = lavados?.reduce((sum, l) => sum + (l.precio_final || 0), 0) || 0;
        const totalGastos = gastos?.reduce((sum, g) => sum + (g.monto || 0), 0) || 0;
        const gananciaNeta = ganancias - totalGastos;
        
        const gananciasElem = document.getElementById('gananciasMensuales');
        const gastosElem = document.getElementById('gastosMensuales');
        const gananciaNetaElem = document.getElementById('gananciaNeta');
        const totalLavadosElem = document.getElementById('totalLavados');
        
        if (gananciasElem) gananciasElem.textContent = `$${ganancias.toFixed(2)}`;
        if (gastosElem) gastosElem.textContent = `$${totalGastos.toFixed(2)}`;
        if (gananciaNetaElem) gananciaNetaElem.textContent = `$${gananciaNeta.toFixed(2)}`;
        if (totalLavadosElem) totalLavadosElem.textContent = lavados?.length || 0;
        
        // Actualizar gráfico
        if (lavados && lavados.length > 0) {
            updateChart(lavados);
        }
        
    } catch (error) {
        console.error('Error cargando dashboard:', error);
        showError('Error al cargar el dashboard');
    }
}

// Actualizar gráfico de ganancias
function updateChart(lavados) {
    const gananciasPorDia = {};
    lavados.forEach(lavado => {
        const fecha = formatDate(lavado.fecha).split(',')[0]; // Solo la fecha sin hora
        gananciasPorDia[fecha] = (gananciasPorDia[fecha] || 0) + lavado.precio_final;
    });
    
    const fechas = Object.keys(gananciasPorDia).sort();
    const valores = fechas.map(f => gananciasPorDia[f]);
    
    const ctx = document.getElementById('gananciasChart')?.getContext('2d');
    if (!ctx) return;
    
    if (gananciasChart) {
        gananciasChart.destroy();
    }
    
    gananciasChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: fechas,
            datasets: [{
                label: 'Ganancias por día ($)',
                data: valores,
                borderColor: '#e94560',
                backgroundColor: 'rgba(233, 69, 96, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `$${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            }
        }
    });
}

// Cargar servicios para gestión de precios
async function loadServicios() {
    try {
        const { data: servicios, error } = await supabase
            .from('servicios')
            .select('*')
            .order('tipo', { ascending: true });
        
        if (error) throw error;
        
        const tbody = document.getElementById('serviciosList');
        if (!tbody) return;
        
        if (!servicios || servicios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No hay servicios registrados</td></tr>';
            return;
        }
        
        tbody.innerHTML = servicios.map(s => `
            <tr>
                <td>${s.tipo === 'auto' ? 'Auto' : 'Moto'}</td>
                <td>${escapeHtml(s.nombre)}</td>
                <td>$${Number(s.precio_venta).toFixed(2)}</td>
                <td>$${Number(s.comision_empleado).toFixed(2)}</td>
                <td><button class="delete-btn" onclick="deleteServicio(${s.id})">Eliminar</button></td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error cargando servicios:', error);
        showError('Error al cargar servicios');
    }
}

// Agregar nuevo servicio
async function addServicio(event) {
    event.preventDefault();
    
    const tipo = document.getElementById('tipoServicio')?.value;
    const nombre = document.getElementById('nombreServicio')?.value;
    const precioVenta = parseFloat(document.getElementById('precioVenta')?.value);
    const comisionEmpleado = parseFloat(document.getElementById('comisionEmpleado')?.value);
    
    if (!tipo || !nombre || isNaN(precioVenta) || isNaN(comisionEmpleado)) {
        showError('Por favor, completa todos los campos correctamente');
        return;
    }
    
    const nuevoServicio = {
        tipo: tipo,
        nombre: nombre,
        precio_venta: precioVenta,
        comision_empleado: comisionEmpleado,
        activo: true
    };
    
    try {
        const { error } = await supabase
            .from('servicios')
            .insert([nuevoServicio]);
        
        if (error) throw error;
        
        document.getElementById('servicioForm').reset();
        await loadServicios();
        showSuccess('Servicio agregado correctamente');
        
    } catch (error) {
        console.error('Error agregando servicio:', error);
        showError('Error al agregar servicio: ' + error.message);
    }
}

// Eliminar servicio
window.deleteServicio = async (id) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este servicio?')) return;
    
    try {
        const { error } = await supabase
            .from('servicios')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        await loadServicios();
        showSuccess('Servicio eliminado correctamente');
        
    } catch (error) {
        console.error('Error eliminando servicio:', error);
        showError('Error al eliminar servicio');
    }
};

// Cargar empleados
async function loadEmpleados() {
    try {
        const { data: empleados, error } = await supabase
            .from('empleados')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const tbody = document.getElementById('empleadosList');
        if (!tbody) return;
        
        if (!empleados || empleados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No hay empleados registrados</td></tr>';
            return;
        }
        
        tbody.innerHTML = empleados.map(e => `
            <tr>
                <td>${escapeHtml(e.nombre)}</td>
                <td>${escapeHtml(e.email)}</td>
                <td>${e.activo ? 'Activo' : 'Inactivo'}</td>
                <td><button class="delete-btn" onclick="deleteEmpleado('${e.id}')">Eliminar</button></td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error cargando empleados:', error);
        showError('Error al cargar empleados');
    }
}

// Crear nuevo empleado
async function createEmpleado(event) {
    event.preventDefault();
    
    const email = document.getElementById('emailEmpleado')?.value;
    const password = document.getElementById('passwordEmpleado')?.value;
    const nombre = document.getElementById('nombreEmpleado')?.value;
    
    if (!email || !password || !nombre) {
        showError('Por favor, completa todos los campos');
        return;
    }
    
    try {
        // Crear usuario en auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password
        });
        
        if (authError) throw authError;
        
        if (!authData.user) {
            throw new Error('No se pudo crear el usuario');
        }
        
        // Crear registro en tabla empleados
        const { error: empError } = await supabase
            .from('empleados')
            .insert([{
                user_id: authData.user.id,
                nombre: nombre,
                email: email,
                activo: true
            }]);
        
        if (empError) throw empError;
        
        document.getElementById('empleadoForm').reset();
        await loadEmpleados();
        showSuccess('Empleado creado correctamente');
        
    } catch (error) {
        console.error('Error creando empleado:', error);
        showError('Error al crear empleado: ' + error.message);
    }
}

// Eliminar empleado
window.deleteEmpleado = async (id) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este empleado?')) return;
    
    try {
        const { error } = await supabase
            .from('empleados')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        await loadEmpleados();
        showSuccess('Empleado eliminado correctamente');
        
    } catch (error) {
        console.error('Error eliminando empleado:', error);
        showError('Error al eliminar empleado');
    }
};

// Cargar historial completo
async function loadHistorial() {
    try {
        let query = supabase
            .from('lavados')
            .select(`
                *,
                empleados (nombre),
                servicios (nombre)
            `)
            .order('fecha', { ascending: false });
        
        const fechaFiltro = document.getElementById('filtroFecha')?.value;
        if (fechaFiltro) {
            const startDate = new Date(fechaFiltro);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(fechaFiltro);
            endDate.setHours(23, 59, 59, 999);
            query = query.gte('fecha', startDate.toISOString())
                         .lte('fecha', endDate.toISOString());
        }
        
        const empleadoFiltro = document.getElementById('filtroEmpleado')?.value;
        if (empleadoFiltro && empleadoFiltro !== '') {
            query = query.eq('empleado_id', empleadoFiltro);
        }
        
        const { data: lavados, error } = await query;
        
        if (error) throw error;
        
        const tbody = document.getElementById('historialList');
        if (!tbody) return;
        
        if (!lavados || lavados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No hay lavados registrados</td></tr>';
            return;
        }
        
        tbody.innerHTML = lavados.map(l => `
            <tr>
                <td>${formatDate(l.fecha)}</td>
                <td>${l.empleados?.nombre || 'N/A'}</td>
                <td>${escapeHtml(l.modelo_auto)}</td>
                <td>${escapeHtml(l.matricula)}</td>
                <td>${l.servicios?.nombre || 'N/A'}</td>
                <td>$${Number(l.precio_final).toFixed(2)}</td>
                <td>$${Number(l.comision_ganada).toFixed(2)}</td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error cargando historial:', error);
        showError('Error al cargar el historial');
    }
}

// Cargar empleados para filtro
async function loadEmpleadosFiltro() {
    try {
        const { data: empleados, error } = await supabase
            .from('empleados')
            .select('id, nombre')
            .eq('activo', true);
        
        if (error) throw error;
        
        const select = document.getElementById('filtroEmpleado');
        if (select) {
            select.innerHTML = '<option value="">Todos los empleados</option>' +
                (empleados || []).map(e => `<option value="${e.id}">${escapeHtml(e.nombre)}</option>`).join('');
        }
        
    } catch (error) {
        console.error('Error cargando empleados:', error);
    }
}

// Registrar gasto
async function addGasto(event) {
    event.preventDefault();
    
    const concepto = document.getElementById('concepto')?.value;
    const monto = parseFloat(document.getElementById('monto')?.value);
    
    if (!concepto || isNaN(monto) || monto <= 0) {
        showError('Por favor, ingresa un concepto y monto válido');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('gastos')
            .insert([{
                concepto: concepto,
                monto: monto,
                registrado_por: currentUser.id
            }]);
        
        if (error) throw error;
        
        document.getElementById('gastoForm').reset();
        await loadDashboard();
        showSuccess('Gasto registrado correctamente');
        
    } catch (error) {
        console.error('Error registrando gasto:', error);
        showError('Error al registrar gasto');
    }
}

// ==================== EMPLEADOS ====================

// Cargar servicios para empleados
async function loadServiciosEmpleado() {
    try {
        const { data: servicios, error } = await supabase
            .from('servicios')
            .select('*')
            .eq('activo', true)
            .order('tipo', { ascending: true });
        
        if (error) throw error;
        
        const select = document.getElementById('servicioId');
        if (!select) return;
        
        if (!servicios || servicios.length === 0) {
            select.innerHTML = '<option value="">No hay servicios disponibles</option>';
            return;
        }
        
        select.innerHTML = '<option value="">Seleccionar servicio</option>' +
            servicios.map(s => `<option value="${s.id}" data-precio="${s.precio_venta}" data-comision="${s.comision_empleado}">
                ${s.tipo === 'auto' ? '🚗' : '🏍️'} ${escapeHtml(s.nombre)} - $${Number(s.precio_venta).toFixed(2)}
            </option>`).join('');
        
        // Agregar evento para calcular precio automáticamente
        select.removeEventListener('change', handleServicioChange);
        select.addEventListener('change', handleServicioChange);
        
    } catch (error) {
        console.error('Error cargando servicios:', error);
        showError('Error al cargar servicios');
    }
}

function handleServicioChange(event) {
    const selectedOption = event.target.options[event.target.selectedIndex];
    const precio = selectedOption.getAttribute('data-precio');
    const precioFinalInput = document.getElementById('precioFinal');
    if (precio && precioFinalInput) {
        precioFinalInput.value = parseFloat(precio).toFixed(2);
    }
}

// Registrar lavado (empleado)
async function registerLavado(event) {
    event.preventDefault();
    
    if (!currentEmpleado) {
        showError('No se ha identificado al empleado');
        return;
    }
    
    const servicioId = parseInt(document.getElementById('servicioId')?.value);
    const modeloAuto = document.getElementById('modeloAuto')?.value;
    const matricula = document.getElementById('matricula')?.value;
    const observaciones = document.getElementById('observaciones')?.value;
    const precioFinal = parseFloat(document.getElementById('precioFinal')?.value);
    
    if (!servicioId || !modeloAuto || !matricula || isNaN(precioFinal)) {
        showError('Por favor, completa todos los campos requeridos');
        return;
    }
    
    // Obtener comisión del servicio seleccionado
    const servicioSelect = document.getElementById('servicioId');
    const selectedOption = servicioSelect.options[servicioSelect.selectedIndex];
    const comision = parseFloat(selectedOption.getAttribute('data-comision'));
    
    if (isNaN(comision)) {
        showError('Error al obtener la comisión del servicio');
        return;
    }
    
    const nuevoLavado = {
        empleado_id: currentEmpleado.id,
        servicio_id: servicioId,
        modelo_auto: modeloAuto,
        matricula: matricula.toUpperCase(),
        observaciones: observaciones || '',
        precio_final: precioFinal,
        comision_ganada: comision
    };
    
    try {
        const { error } = await supabase
            .from('lavados')
            .insert([nuevoLavado]);
        
        if (error) throw error;
        
        document.getElementById('lavadoForm').reset();
        document.getElementById('precioFinal').value = '';
        showSuccess('Lavado registrado correctamente');
        
        // Cambiar a pestaña de historial
        const historialTab = document.querySelector('[data-tab="historial"]');
        if (historialTab) {
            historialTab.click();
        }
        
    } catch (error) {
        console.error('Error registrando lavado:', error);
        showError('Error al registrar lavado: ' + error.message);
    }
}

// Cargar historial personal del empleado
async function loadHistorialPersonal() {
    try {
        let query = supabase
            .from('lavados')
            .select(`
                *,
                servicios (nombre)
            `)
            .eq('empleado_id', currentEmpleado.id)
            .order('fecha', { ascending: false });
        
        const fechaFiltro = document.getElementById('filtroFechaPersonal')?.value;
        if (fechaFiltro) {
            const startDate = new Date(fechaFiltro);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(fechaFiltro);
            endDate.setHours(23, 59, 59, 999);
            query = query.gte('fecha', startDate.toISOString())
                         .lte('fecha', endDate.toISOString());
        }
        
        const { data: lavados, error } = await query;
        
        if (error) throw error;
        
        const tbody = document.getElementById('historialPersonalList');
        if (!tbody) return;
        
        const totalComisiones = (lavados || []).reduce((sum, l) => sum + (l.comision_ganada || 0), 0);
        const totalLavados = (lavados || []).length;
        
        const totalComisionesElem = document.getElementById('totalComisiones');
        const totalLavadosPersonalElem = document.getElementById('totalLavadosPersonal');
        
        if (totalComisionesElem) totalComisionesElem.textContent = `$${totalComisiones.toFixed(2)}`;
        if (totalLavadosPersonalElem) totalLavadosPersonalElem.textContent = totalLavados;
        
        if (!lavados || lavados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No hay lavados registrados</td></tr>';
            return;
        }
        
        tbody.innerHTML = lavados.map(l => `
            <tr>
                <td>${formatDate(l.fecha)}</td>
                <td>${escapeHtml(l.modelo_auto)}</td>
                <td>${escapeHtml(l.matricula)}</td>
                <td>${l.servicios?.nombre || 'N/A'}</td>
                <td>$${Number(l.precio_final).toFixed(2)}</td>
                <td>$${Number(l.comision_ganada).toFixed(2)}</td>
                <td>${escapeHtml(l.observaciones || '-')}</td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error cargando historial personal:', error);
        showError('Error al cargar tu historial');
    }
}

// ==================== UTILIDADES ADICIONALES ====================

// Escapar HTML para prevenir XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== INICIALIZACIÓN ====================

// Navegación entre tabs
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabs = document.querySelectorAll('.tab-content');
    
    if (navItems.length === 0) return;
    
    navItems.forEach(item => {
        item.removeEventListener('click', handleNavClick);
        item.addEventListener('click', handleNavClick);
    });
}

async function handleNavClick(event) {
    const item = event.currentTarget;
    const tabId = item.getAttribute('data-tab');
    
    // Actualizar clases activas
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    
    item.classList.add('active');
    const activeTab = document.getElementById(tabId);
    if (activeTab) activeTab.classList.add('active');
    
    // Cargar datos específicos al cambiar de tab
    if (tabId === 'historial' && window.location.pathname.includes('admin.html')) {
        await loadHistorial();
    } else if (tabId === 'historial' && window.location.pathname.includes('empleados.html')) {
        await loadHistorialPersonal();
    } else if (tabId === 'dashboard' && window.location.pathname.includes('admin.html')) {
        await loadDashboard();
    } else if (tabId === 'precios' && window.location.pathname.includes('admin.html')) {
        await loadServicios();
    } else if (tabId === 'empleados' && window.location.pathname.includes('admin.html')) {
        await loadEmpleados();
    }
}

// Inicializar según la página
async function init() {
    console.log('Inicializando aplicación...');
    
    // Verificar autenticación
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) return;
    
    // Configurar logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.removeEventListener('click', logout);
        logoutBtn.addEventListener('click', logout);
    }
    
    // Inicializar navegación
    initNavigation();
    
    // Inicializar según la página
    const isAdminPage = window.location.pathname.includes('admin.html');
    
    if (isAdminPage) {
        console.log('Inicializando panel de administración...');
        // Admin: cargar todos los módulos
        await loadDashboard();
        await loadServicios();
        await loadEmpleados();
        await loadHistorial();
        await loadEmpleadosFiltro();
        
        // Configurar eventos de admin
        const servicioForm = document.getElementById('servicioForm');
        if (servicioForm) {
            servicioForm.removeEventListener('submit', addServicio);
            servicioForm.addEventListener('submit', addServicio);
        }
        
        const empleadoForm = document.getElementById('empleadoForm');
        if (empleadoForm) {
            empleadoForm.removeEventListener('submit', createEmpleado);
            empleadoForm.addEventListener('submit', createEmpleado);
        }
        
        const gastoForm = document.getElementById('gastoForm');
        if (gastoForm) {
            gastoForm.removeEventListener('submit', addGasto);
            gastoForm.addEventListener('submit', addGasto);
        }
        
        const filtroFecha = document.getElementById('filtroFecha');
        if (filtroFecha) {
            filtroFecha.removeEventListener('change', loadHistorial);
            filtroFecha.addEventListener('change', loadHistorial);
        }
        
        const filtroEmpleado = document.getElementById('filtroEmpleado');
        if (filtroEmpleado) {
            filtroEmpleado.removeEventListener('change', loadHistorial);
            filtroEmpleado.addEventListener('change', loadHistorial);
        }
        
    } else if (window.location.pathname.includes('empleados.html')) {
        console.log('Inicializando panel de empleados...');
        // Empleado: cargar módulos de empleado
        await loadServiciosEmpleado();
        await loadHistorialPersonal();
        
        // Configurar eventos de empleado
        const lavadoForm = document.getElementById('lavadoForm');
        if (lavadoForm) {
            lavadoForm.removeEventListener('submit', registerLavado);
            lavadoForm.addEventListener('submit', registerLavado);
        }
        
        const filtroFechaPersonal = document.getElementById('filtroFechaPersonal');
        if (filtroFechaPersonal) {
            filtroFechaPersonal.removeEventListener('change', loadHistorialPersonal);
            filtroFechaPersonal.addEventListener('change', loadHistorialPersonal);
        }
    }
    
    console.log('Aplicación inicializada correctamente');
}

// Iniciar aplicación cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
