// ==================== VARIABLES GLOBALES ====================
let usuarioActual = null;

// ==================== LOGIN ====================
window.hacerLogin = async function() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const msgDiv = document.getElementById('msgLogin');
    
    if (!username || !password) {
        msgDiv.innerHTML = '<div class="error-msg">❌ Complete todos los campos</div>';
        return;
    }
    
    try {
        // Buscar usuario en Supabase
        const { data: usuarios, error } = await supabase
            .from('empleados')
            .select('*')
            .eq('username', username)
            .eq('password', password);
        
        if (error) throw error;
        
        if (!usuarios || usuarios.length === 0) {
            msgDiv.innerHTML = '<div class="error-msg">❌ Usuario o contraseña incorrectos</div>';
            return;
        }
        
        const usuario = usuarios[0];
        usuarioActual = {
            id: usuario.id,
            username: usuario.username,
            nombre: usuario.nombre,
            rol: usuario.rol
        };
        
        // Guardar en sessionStorage
        sessionStorage.setItem('usuarioActual', JSON.stringify(usuarioActual));
        
        // Redirigir según rol
        if (usuario.rol === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'empleados.html';
        }
        
    } catch (error) {
        console.error('Error:', error);
        msgDiv.innerHTML = '<div class="error-msg">❌ Error de conexión</div>';
    }
};

window.cerrarSesion = function() {
    sessionStorage.removeItem('usuarioActual');
    window.location.href = 'index.html';
};

// ==================== VERIFICAR SESIÓN ====================
function verificarSesion() {
    const userData = sessionStorage.getItem('usuarioActual');
    if (!userData) {
        window.location.href = 'index.html';
        return null;
    }
    usuarioActual = JSON.parse(userData);
    
    const userInfoElem = document.getElementById('userInfo');
    if (userInfoElem) {
        userInfoElem.innerHTML = `👤 ${usuarioActual.nombre} (${usuarioActual.rol === 'admin' ? 'Admin' : 'Empleado'})`;
    }
    
    return usuarioActual;
}

// ==================== ADMIN - DASHBOARD ====================
window.mostrarSeccion = function(seccion) {
    document.querySelectorAll('.seccion').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(`seccion-${seccion}`).classList.add('active');
    event.target.classList.add('active');
    
    if (seccion === 'dashboard') actualizarDashboard();
    if (seccion === 'precios') cargarServicios();
    if (seccion === 'empleados') cargarEmpleados();
    if (seccion === 'historial') cargarHistorialAdmin();
};

async function actualizarDashboard() {
    try {
        // Obtener lavados
        const { data: lavados } = await supabase.from('lavados').select('*');
        // Obtener gastos
        const { data: gastos } = await supabase.from('gastos').select('*');
        
        const totalVentas = (lavados || []).reduce((sum, l) => sum + (l.precio || 0), 0);
        const totalGastos = (gastos || []).reduce((sum, g) => sum + (g.monto || 0), 0);
        const ganancia = totalVentas - totalGastos;
        
        document.getElementById('statsGrid').innerHTML = `
            <div class="stat-card"><h3>💰 Ganancias</h3><div class="stat-value">$${totalVentas.toLocaleString()}</div></div>
            <div class="stat-card"><h3>💸 Gastos</h3><div class="stat-value">$${totalGastos.toLocaleString()}</div></div>
            <div class="stat-card"><h3>📈 Ganancia Neta</h3><div class="stat-value">$${ganancia.toLocaleString()}</div></div>
            <div class="stat-card"><h3>🚗 Lavados</h3><div class="stat-value">${lavados?.length || 0}</div></div>
        `;
    } catch (error) {
        console.error('Error:', error);
    }
}

window.registrarGasto = async function() {
    const concepto = document.getElementById('gastoConcepto').value;
    const monto = parseFloat(document.getElementById('gastoMonto').value);
    
    if (!concepto || !monto) {
        alert('Complete todos los campos');
        return;
    }
    
    try {
        const { error } = await supabase.from('gastos').insert([{
            concepto: concepto,
            monto: monto,
            registrado_por: usuarioActual.username,
            fecha: new Date().toISOString()
        }]);
        
        if (error) throw error;
        
        document.getElementById('gastoConcepto').value = '';
        document.getElementById('gastoMonto').value = '';
        
        await actualizarDashboard();
        alert('✅ Gasto registrado');
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error al registrar gasto');
    }
};

// ==================== ADMIN - SERVICIOS ====================
async function cargarServicios() {
    try {
        const { data: servicios } = await supabase
            .from('servicios')
            .select('*')
            .eq('activo', true);
        
        let html = '';
        (servicios || []).forEach(s => {
            html += `<tr>
                <td>${s.nombre}</td>
                <td>$${s.precio.toLocaleString()}</td>
                <td>$${s.comision.toLocaleString()}</td>
                <td><button onclick="eliminarServicio(${s.id})" class="btn-danger">Eliminar</button></td>
            </tr>`;
        });
        document.getElementById('listaServicios').innerHTML = html;
        
    } catch (error) {
        console.error('Error:', error);
    }
}

window.agregarServicio = async function() {
    const nombre = document.getElementById('nombreServicio').value;
    const precio = parseFloat(document.getElementById('precioServicio').value);
    const comision = parseFloat(document.getElementById('comisionServicio').value);
    
    if (!nombre || !precio) {
        alert('Complete nombre y precio');
        return;
    }
    
    try {
        const { error } = await supabase.from('servicios').insert([{
            nombre: nombre,
            precio: precio,
            comision: comision || precio * 0.3,
            activo: true
        }]);
        
        if (error) throw error;
        
        document.getElementById('nombreServicio').value = '';
        document.getElementById('precioServicio').value = '';
        document.getElementById('comisionServicio').value = '';
        
        await cargarServicios();
        alert('✅ Servicio agregado');
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error al agregar servicio');
    }
};

window.eliminarServicio = async function(id) {
    if (!confirm('¿Eliminar este servicio?')) return;
    
    try {
        const { error } = await supabase
            .from('servicios')
            .update({ activo: false })
            .eq('id', id);
        
        if (error) throw error;
        
        await cargarServicios();
        alert('✅ Servicio eliminado');
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error al eliminar servicio');
    }
};

// ==================== ADMIN - EMPLEADOS ====================
async function cargarEmpleados() {
    try {
        const { data: empleados } = await supabase
            .from('empleados')
            .select('*')
            .neq('rol', 'admin');
        
        let html = '';
        (empleados || []).forEach(e => {
            html += `<tr>
                <td>${e.username}</td>
                <td>${e.nombre}</td>
                <td>${e.activo ? 'Activo' : 'Inactivo'}</td>
                <td><button onclick="eliminarEmpleado('${e.id}')" class="btn-danger">Eliminar</button></td>
            </tr>`;
        });
        document.getElementById('listaEmpleados').innerHTML = html;
        
    } catch (error) {
        console.error('Error:', error);
    }
}

window.agregarEmpleado = async function() {
    const username = document.getElementById('userEmpleado').value;
    const nombre = document.getElementById('nombreEmpleado').value;
    const password = document.getElementById('passEmpleado').value;
    
    if (!username || !nombre || !password) {
        alert('Complete todos los campos');
        return;
    }
    
    try {
        const { error } = await supabase.from('empleados').insert([{
            username: username,
            nombre: nombre,
            password: password,
            rol: 'empleado',
            activo: true
        }]);
        
        if (error) throw error;
        
        document.getElementById('userEmpleado').value = '';
        document.getElementById('nombreEmpleado').value = '';
        document.getElementById('passEmpleado').value = '';
        
        await cargarEmpleados();
        alert('✅ Empleado agregado');
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error al agregar empleado');
    }
};

window.eliminarEmpleado = async function(id) {
    if (!confirm('¿Eliminar este empleado?')) return;
    
    try {
        const { error } = await supabase
            .from('empleados')
            .update({ activo: false })
            .eq('id', id);
        
        if (error) throw error;
        
        await cargarEmpleados();
        alert('✅ Empleado eliminado');
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error al eliminar empleado');
    }
};

// ==================== ADMIN - HISTORIAL ====================
async function cargarHistorialAdmin() {
    try {
        const { data: lavados } = await supabase
            .from('lavados')
            .select('*')
            .order('fecha', { ascending: false });
        
        let html = '';
        (lavados || []).forEach(l => {
            html += `<tr>
                <td>${new Date(l.fecha).toLocaleDateString()}</td>
                <td>${l.empleado_username}</td>
                <td>${l.modelo_auto}</td>
                <td>${l.matricula}</td>
                <td>${l.servicio}</td>
                <td>$${l.precio.toLocaleString()}</td>
            </tr>`;
        });
        document.getElementById('listaHistorial').innerHTML = html;
        
    } catch (error) {
        console.error('Error:', error);
    }
}

// ==================== EMPLEADO - FUNCIONES ====================
window.mostrarSeccionEmpleado = function(seccion) {
    document.querySelectorAll('#empleadoPanel .seccion').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('#empleadoPanel .nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(`empleado-seccion-${seccion}`).classList.add('active');
    event.target.classList.add('active');
    
    if (seccion === 'historial') cargarMiHistorial();
};

async function cargarServiciosSelect() {
    try {
        const { data: servicios } = await supabase
            .from('servicios')
            .select('*')
            .eq('activo', true);
        
        const select = document.getElementById('servicioSelect');
        select.innerHTML = '<option value="">Seleccionar servicio</option>';
        
        (servicios || []).forEach(s => {
            const option = document.createElement('option');
            option.value = JSON.stringify(s);
            option.textContent = `${s.nombre} - $${s.precio.toLocaleString()}`;
            select.appendChild(option);
        });
        
        select.onchange = function() {
            if (this.value) {
                const s = JSON.parse(this.value);
                document.getElementById('precioFinal').value = s.precio;
            }
        };
        
    } catch (error) {
        console.error('Error:', error);
    }
}

window.registrarLavado = async function() {
    const servicioStr = document.getElementById('servicioSelect').value;
    
    if (!servicioStr) {
        alert('Seleccione un servicio');
        return;
    }
    
    const servicio = JSON.parse(servicioStr);
    const modelo = document.getElementById('modeloAuto').value;
    const matricula = document.getElementById('matriculaAuto').value;
    
    if (!modelo || !matricula) {
        alert('Complete modelo y matrícula');
        return;
    }
    
    try {
        const { error } = await supabase.from('lavados').insert([{
            empleado_id: usuarioActual.id,
            empleado_username: usuarioActual.username,
            modelo_auto: modelo,
            matricula: matricula,
            servicio: servicio.nombre,
            precio: parseFloat(document.getElementById('precioFinal').value),
            comision: servicio.comision,
            observaciones: document.getElementById('observaciones').value,
            fecha: new Date().toISOString()
        }]);
        
        if (error) throw error;
        
        document.getElementById('modeloAuto').value = '';
        document.getElementById('matriculaAuto').value = '';
        document.getElementById('observaciones').value = '';
        document.getElementById('servicioSelect').value = '';
        document.getElementById('precioFinal').value = '';
        
        alert('✅ Lavado registrado');
        await cargarMiHistorial();
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error al registrar lavado');
    }
};

async function cargarMiHistorial() {
    try {
        const { data: lavados } = await supabase
            .from('lavados')
            .select('*')
            .eq('empleado_username', usuarioActual.username)
            .order('fecha', { ascending: false });
        
        const totalComisiones = (lavados || []).reduce((sum, l) => sum + (l.comision || 0), 0);
        
        document.getElementById('statsEmpleado').innerHTML = `
            <div class="stat-card"><h3>💰 Total Comisiones</h3><div class="stat-value">$${totalComisiones.toLocaleString()}</div></div>
            <div class="stat-card"><h3>🚗 Lavados Realizados</h3><div class="stat-value">${lavados?.length || 0}</div></div>
        `;
        
        let html = '';
        (lavados || []).forEach(l => {
            html += `<tr>
                <td>${new Date(l.fecha).toLocaleDateString()}</td>
                <td>${l.modelo_auto}</td>
                <td>${l.matricula}</td>
                <td>${l.servicio}</td>
                <td>$${l.precio.toLocaleString()}</td>
                <td>$${l.comision.toLocaleString()}</td>
            </tr>`;
        });
        document.getElementById('miHistorial').innerHTML = html;
        
    } catch (error) {
        console.error('Error:', error);
    }
}

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', async function() {
    const user = verificarSesion();
    if (!user) return;
    
    if (window.location.pathname.includes('admin.html')) {
        if (user.rol !== 'admin') {
            window.location.href = 'empleados.html';
            return;
        }
        await actualizarDashboard();
        await cargarServicios();
        await cargarEmpleados();
        await cargarHistorialAdmin();
        
    } else if (window.location.pathname.includes('empleados.html')) {
        if (user.rol !== 'empleado') {
            window.location.href = 'admin.html';
            return;
        }
        await cargarServiciosSelect();
        await cargarMiHistorial();
    }
});
