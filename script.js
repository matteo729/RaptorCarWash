// Configuración de Supabase - ¡REEMPLAZA CON TUS DATOS!
const SUPABASE_URL = 'https://ldalildhdukyjnvmjlsg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkYWxpbGRoZHVreWpudm1qbHNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNzcxMTYsImV4cCI6MjA5MTg1MzExNn0.f-sLoQgbtBfqmoPweJ0am7pnCIGiaZhkGaAjc_s8Y8A';

// Inicializar Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    
    if (elementId) {
        const element = document.getElementById(elementId);
        element.insertBefore(errorDiv, element.firstChild);
        setTimeout(() => errorDiv.remove(), 3000);
    } else {
        document.body.insertBefore(errorDiv, document.body.firstChild);
        setTimeout(() => errorDiv.remove(), 3000);
    }
}

// Formatear fecha
function formatDate(date) {
    return new Date(date).toLocaleDateString('es-ES');
}

// ==================== AUTENTICACIÓN ====================

// Verificar sesión actual
async function checkAuth() {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
        // Redirigir a página de login (deberás crear login.html)
        window.location.href = 'login.html';
        return false;
    }
    
    currentUser = session.user;
    
    // Verificar si es admin o empleado según la página actual
    const isAdminPage = window.location.pathname.includes('admin.html');
    
    if (isAdminPage) {
        // Verificar si el usuario es admin (podrías tener una tabla de admins)
        // Por simplicidad, asumimos que el primer usuario es admin
        const { data: adminCheck, error: adminError } = await supabase
            .from('empleados')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();
        
        // Si no es admin y está en admin.html, redirigir
        if (!adminError && adminCheck) {
            // Es empleado, redirigir a empleados.html
            window.location.href = 'empleados.html';
        }
    } else {
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
    }
    
    return true;
}

// Cerrar sesión
async function logout() {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
}

// ==================== ADMINISTRACIÓN ====================

// Cargar dashboard con estadísticas
async function loadDashboard() {
    try {
        const fechaInicio = new Date();
        fechaInicio.setDate(1); // Primer día del mes actual
        fechaInicio.setHours(0, 0, 0, 0);
        
        // Obtener lavados del mes
        const { data: lavados, error: lavadosError } = await supabase
            .from('lavados')
            .select('*')
            .gte('fecha', fechaInicio.toISOString());
        
        if (lavadosError) throw lavadosError;
        
        // Obtener gastos del mes
        const { data: gastos, error: gastosError } = await supabase
            .from('gastos')
            .select('*')
            .gte('fecha', fechaInicio.toISOString());
        
        if (gastosError) throw gastosError;
        
        const ganancias = lavados?.reduce((sum, l) => sum + l.precio_final, 0) || 0;
        const totalGastos = gastos?.reduce((sum, g) => sum + g.monto, 0) || 0;
        const gananciaNeta = ganancias - totalGastos;
        
        document.getElementById('gananciasMensuales').textContent = `$${ganancias.toFixed(2)}`;
        document.getElementById('gastosMensuales').textContent = `$${totalGastos.toFixed(2)}`;
        document.getElementById('gananciaNeta').textContent = `$${gananciaNeta.toFixed(2)}`;
        document.getElementById('totalLavados').textContent = lavados?.length || 0;
        
        // Actualizar gráfico
        updateChart(lavados || []);
        
    } catch (error) {
        console.error('Error cargando dashboard:', error);
        showError('Error al cargar el dashboard');
    }
}

// Actualizar gráfico de ganancias
async function updateChart(lavados) {
    const gananciasPorDia = {};
    lavados.forEach(lavado => {
        const fecha = formatDate(lavado.fecha);
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
                label: 'Ganancias por día',
                data: valores,
                borderColor: '#e94560',
                backgroundColor: 'rgba(233, 69, 96, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
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
        
        tbody.innerHTML = servicios.map(s => `
            <tr>
                <td>${s.tipo === 'auto' ? 'Auto' : 'Moto'}</td>
                <td>${s.nombre}</td>
                <td>$${s.precio_venta.toFixed(2)}</td>
                <td>$${s.comision_empleado.toFixed(2)}</td>
                <td><button class="delete-btn" onclick="deleteServicio(${s.id})">Eliminar</button></td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error cargando servicios:', error);
    }
}

// Agregar nuevo servicio
async function addServicio(event) {
    event.preventDefault();
    
    const nuevoServicio = {
        tipo: document.getElementById('tipoServicio').value,
        nombre: document.getElementById('nombreServicio').value,
        precio_venta: parseFloat(document.getElementById('precioVenta').value),
        comision_empleado: parseFloat(document.getElementById('comisionEmpleado').value),
        activo: true
    };
    
    try {
        const { error } = await supabase
            .from('servicios')
            .insert([nuevoServicio]);
        
        if (error) throw error;
        
        // Limpiar formulario
        document.getElementById('servicioForm').reset();
        // Recargar lista
        loadServicios();
        showError('Servicio agregado correctamente');
        
    } catch (error) {
        console.error('Error agregando servicio:', error);
        showError('Error al agregar servicio');
    }
}

// Eliminar servicio
window.deleteServicio = async (id) => {
    if (!confirm('¿Eliminar este servicio?')) return;
    
    try {
        const { error } = await supabase
            .from('servicios')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        loadServicios();
        showError('Servicio eliminado');
        
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
        
        tbody.innerHTML = empleados.map(e => `
            <tr>
                <td>${e.nombre}</td>
                <td>${e.email}</td>
                <td>${e.activo ? 'Activo' : 'Inactivo'}</td>
                <td><button class="delete-btn" onclick="deleteEmpleado('${e.id}')">Eliminar</button></td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error cargando empleados:', error);
    }
}

// Crear nuevo empleado (usuario en auth)
async function createEmpleado(event) {
    event.preventDefault();
    
    const email = document.getElementById('emailEmpleado').value;
    const password = document.getElementById('passwordEmpleado').value;
    const nombre = document.getElementById('nombreEmpleado').value;
    
    try {
        // Crear usuario en auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password
        });
        
        if (authError) throw authError;
        
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
        loadEmpleados();
        showError('Empleado creado correctamente');
        
    } catch (error) {
        console.error('Error creando empleado:', error);
        showError('Error al crear empleado: ' + error.message);
    }
}

// Eliminar empleado
window.deleteEmpleado = async (id) => {
    if (!confirm('¿Eliminar este empleado?')) return;
    
    try {
        const { error } = await supabase
            .from('empleados')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        loadEmpleados();
        showError('Empleado eliminado');
        
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
        if (empleadoFiltro) {
            query = query.eq('empleado_id', empleadoFiltro);
        }
        
        const { data: lavados, error } = await query;
        
        if (error) throw error;
        
        const tbody = document.getElementById('historialList');
        if (!tbody) return;
        
        tbody.innerHTML = lavados.map(l => `
            <tr>
                <td>${formatDate(l.fecha)}</td>
                <td>${l.empleados?.nombre || 'N/A'}</td>
                <td>${l.modelo_auto}</td>
                <td>${l.matricula}</td>
                <td>${l.servicios?.nombre || 'N/A'}</td>
                <td>$${l.precio_final.toFixed(2)}</td>
                <td>$${l.comision_ganada.toFixed(2)}</td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error cargando historial:', error);
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
                empleados.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
        }
        
    } catch (error) {
       
