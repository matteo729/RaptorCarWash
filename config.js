// config.js
// IMPORTANTE: Reemplaza estos valores con los de tu proyecto real de Supabase
// Puedes encontrar estos valores en Supabase > Project Settings > API

const SUPABASE_CONFIG = {
    url: 'https://ldalildhdukyjnvmjlsg.supabase.co',  // Reemplaza con tu URL real
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkYWxpbGRoZHVreWpudm1qbHNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNzcxMTYsImV4cCI6MjA5MTg1MzExNn0.f-sLoQgbtBfqmoPweJ0am7pnCIGiaZhkGaAjc_s8Y8A'  // Reemplaza con tu clave anónima real
};

// Inicializar Supabase (asegúrate de que el script de Supabase esté cargado primero)
const supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
