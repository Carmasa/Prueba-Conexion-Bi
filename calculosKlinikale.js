function inicializarCalculosKlinikale() {
    const yearSelector = document.getElementById('yearSelector');
    const monthSelector = document.getElementById('monthSelector');
    const weekSelector = document.getElementById('weekSelector');
    const selector = document.getElementById('clinicaSelector');

    let allRows = [];
    let objetivosRows = [];

    const csvPath = 'dataSetsMurua/Movimientos.csv';

    yearSelector.addEventListener('change', actualizarDashboard);
    monthSelector.addEventListener('change', actualizarDashboard);
    weekSelector.addEventListener('change', actualizarDashboard);

    cargarKPIs();

    function cargarKPIs() {
        fetch(csvPath)
            .then(res => res.text())
            .then(csv => {
                allRows = Papa.parse(csv, { header: true, delimiter: ';' }).data;
                poblarSelectores(allRows);
                actualizarDashboard();
            });
    }

    function poblarSelectores(rows) {
        const fechas = rows.map(r => r['FechaPresupuesto'] || r['Fecha'] || r['Presupuesto Fecha']).filter(Boolean);
        const años = new Set();
        const meses = new Set();
        const semanas = new Set();
        fechas.forEach(f => {
            const { year, month, week } = getYearMonthWeek(f);
            años.add(year);
            meses.add(month);
            semanas.add(week);
        });

        yearSelector.innerHTML = '<option value="todos">Todos</option>' +
            Array.from(años).sort((a, b) => b - a).map(y => `<option value="${y}">${y}</option>`).join('');
        monthSelector.innerHTML = '<option value="todos">Todos</option>' +
            Array.from(meses).sort((a, b) => a - b).map(m => `<option value="${m}">${m.toString().padStart(2, '0')}</option>`).join('');
        weekSelector.innerHTML = '<option value="todos">Todos</option>' +
            Array.from(semanas).sort((a, b) => a - b).map(w => `<option value="${w}">Semana ${w}</option>`).join('');
    }

    function actualizarDashboard() {
        let rows = allRows;
        const year = yearSelector.value;
        const month = monthSelector.value;
        const week = weekSelector.value;

        rows = rows.filter(r => {
            const fecha = r['FechaPresupuesto'] || r['Fecha'] || r['Presupuesto Fecha'];
            if (!fecha) return false;
            const { year: y, month: m, week: w } = getYearMonthWeek(fecha);
            return (year === 'todos' || y == year) &&
                (month === 'todos' || m == month) &&
                (week === 'todos' || w == week);
        });

        mostrarKPIs(rows);
    }

    function mostrarKPIs(rows) {
        // --- Variables de filtro ---
        const year = yearSelector.value;
        const month = monthSelector.value;
        const week = weekSelector.value;

        // --- Cálculo especial de aceptado (filtra sobre allRows por fecha de aceptación) ---
        const rowsAceptados = allRows.filter(r => {
            const fecha = r['Fecha Aceptacion'] || r['FechaAceptacion'] || r['Importe Presupuesto Aceptado Fecha Aceptacion Fecha'];
            if (!fecha) return false;
            const { year: y, month: m, week: w } = getYearMonthWeek(fecha);
            return (year === 'todos' || y == year) &&
                   (month === 'todos' || m == month) &&
                   (week === 'todos' || w == week);
        });

        // 1. Valor grande: aceptado semanal por mes (como Power BI)
        let aceptadoSemanalPorMes = 0;
        if (week !== 'todos') {
            aceptadoSemanalPorMes = rowsAceptados.reduce((sum, r) =>
                sum + parseFloat((r['Importe Presupuesto Aceptado Fecha Aceptacion'] || r['ImportePresupuestoAceptadoFechaAceptacion'] || '0').replace(',', '.')), 0);
        } else {
            const aceptadoTotal = rowsAceptados.reduce((sum, r) =>
                sum + parseFloat((r['Importe Presupuesto Aceptado Fecha Aceptacion'] || r['ImportePresupuestoAceptadoFechaAceptacion'] || '0').replace(',', '.')), 0);
            const semanasConAceptado = new Set(
                rowsAceptados
                    .filter(r => parseFloat((r['Importe Presupuesto Aceptado Fecha Aceptacion'] || r['ImportePresupuestoAceptadoFechaAceptacion'] || '0').replace(',', '.')) > 0)
                    .map(r => {
                        const fecha = r['Fecha Aceptacion'] || r['FechaAceptacion'] || r['Importe Presupuesto Aceptado Fecha Aceptacion Fecha'];
                        return getYearMonthWeek(fecha).week;
                    })
            ).size;
            aceptadoSemanalPorMes = semanasConAceptado > 0 ? aceptadoTotal / semanasConAceptado : 0;
        }

        // 2. Barra principal: suma total del periodo (Euros Aceptados Fecha Acepta)
        const aceptadoTotalPeriodo = rowsAceptados.reduce((sum, r) =>
            sum + parseFloat((r['Importe Presupuesto Aceptado Fecha Aceptacion'] || r['ImportePresupuestoAceptadoFechaAceptacion'] || '0').replace(',', '.')), 0);

        // --- Resto de KPIs ---
        const presupuestado = rows.reduce((sum, r) => sum + parseFloat((r['Importe Presupuesto'] || '0').replace(',', '.')), 0);
        const pacientesComerciales = new Set(rows.filter(r => r['Importe Presupuesto'] && r['Importe Presupuesto'] !== '')
            .map(r => r['Paciente ID'])).size;
        const pacientesAceptados = new Set(
            rows
                .filter(r => (r['Presupuesto Estado ID'] || '').trim().toUpperCase() === 'AC')
                .map(r => (r['Paciente ID'] || '').trim())
                .filter(id => id !== '')
        ).size;
        const produccion = rows.reduce((sum, r) => sum + parseFloat((r['Importe Producido'] || '0').replace(',', '.')), 0);
        const pacientesTratados = new Set(rows.filter(r => r['Importe Producido'] && r['Importe Producido'] !== '')
            .map(r => r['Paciente ID'])).size;
        const caja = rows.reduce((sum, r) => sum + parseFloat((r['Importe Pagado Tratamiento'] || '0').replace(',', '.')), 0);
        const pacientesCobrados = new Set(rows.filter(r => r['Importe Pagado Tratamiento'] && r['Importe Pagado Tratamiento'] !== '')
            .map(r => r['Paciente ID'])).size;

        // --- Año anterior ---
        const rowsAnioAnterior = allRows.filter(r => {
            const fecha = r['FechaPresupuesto'] || r['Fecha'] || r['Presupuesto Fecha'];
            if (!fecha) return false;
            const { year: y, month: m, week: w } = getYearMonthWeek(fecha);
            return (year !== 'todos' && y == (parseInt(year) - 1)) &&
                (month === 'todos' || m == month) &&
                (week === 'todos' || w == week);
        });

        const presupuestadoAnioAnterior = rowsAnioAnterior.reduce((sum, r) => sum + parseFloat((r['Importe Presupuesto'] || '0').replace(',', '.')), 0);
        const pacientesComercialesAnioAnterior = new Set(rowsAnioAnterior.filter(r => r['Importe Presupuesto'] && r['Importe Presupuesto'] !== '')
            .map(r => r['Paciente ID'])).size;
        let aceptadoAnioAnterior = 0;
        // --- Cálculo especial de aceptado año anterior ---
        const rowsAceptadosAnioAnterior = allRows.filter(r => {
            const fecha = r['Fecha Aceptacion'] || r['FechaAceptacion'] || r['Importe Presupuesto Aceptado Fecha Aceptacion Fecha'];
            if (!fecha) return false;
            const { year: y, month: m, week: w } = getYearMonthWeek(fecha);
            return (year !== 'todos' && y == (parseInt(year) - 1)) &&
                   (month === 'todos' || m == month) &&
                   (week === 'todos' || w == week);
        });
        if (week !== 'todos') {
            aceptadoAnioAnterior = rowsAceptadosAnioAnterior.reduce((sum, r) =>
                sum + parseFloat((r['Importe Presupuesto Aceptado Fecha Aceptacion'] || r['ImportePresupuestoAceptadoFechaAceptacion'] || '0').replace(',', '.')), 0);
        } else {
            const aceptadoTotal = rowsAceptadosAnioAnterior.reduce((sum, r) =>
                sum + parseFloat((r['Importe Presupuesto Aceptado Fecha Aceptacion'] || r['ImportePresupuestoAceptadoFechaAceptacion'] || '0').replace(',', '.')), 0);
            const semanasConAceptado = new Set(
                rowsAceptadosAnioAnterior
                    .filter(r => parseFloat((r['Importe Presupuesto Aceptado Fecha Aceptacion'] || r['ImportePresupuestoAceptadoFechaAceptacion'] || '0').replace(',', '.')) > 0)
                    .map(r => {
                        const fecha = r['Fecha Aceptacion'] || r['FechaAceptacion'] || r['Importe Presupuesto Aceptado Fecha Aceptacion Fecha'];
                        return getYearMonthWeek(fecha).week;
                    })
            ).size;
            aceptadoAnioAnterior = semanasConAceptado > 0 ? aceptadoTotal / semanasConAceptado : 0;
        }
        const pacientesAceptadosAnioAnterior = new Set(
            rowsAnioAnterior
                .filter(r => (r['Presupuesto Estado ID'] || '').trim().toUpperCase() === 'AC')
                .map(r => (r['Paciente ID'] || '').trim())
                .filter(id => id !== '')
        ).size;
        const produccionAnioAnterior = rowsAnioAnterior.reduce((sum, r) => sum + parseFloat((r['Importe Producido'] || '0').replace(',', '.')), 0);
        const pacientesTratadosAnioAnterior = new Set(rowsAnioAnterior.filter(r => r['Importe Producido'] && r['Importe Producido'] !== '')
            .map(r => r['Paciente ID'])).size;
        const cajaAnioAnterior = rowsAnioAnterior.reduce((sum, r) => sum + parseFloat((r['Importe Pagado Tratamiento'] || '0').replace(',', '.')), 0);
        const pacientesCobradosAnioAnterior = new Set(rowsAnioAnterior.filter(r => r['Importe Pagado Tratamiento'] && r['Importe Pagado Tratamiento'] !== '')
            .map(r => r['Paciente ID'])).size;

        // --- Objetivos ---
        const presupuestadoObjetivo = presupuestadoAnioAnterior * 1.2;
        const pacientesComercialesObjetivo = pacientesComercialesAnioAnterior * 1.2;
        const aceptadoObjetivo = aceptadoAnioAnterior * 1.2;
        const pacientesAceptadosObjetivo = pacientesAceptadosAnioAnterior * 1.2;
        const produccionObjetivo = produccionAnioAnterior * 1.2;
        const pacientesTratadosObjetivo = pacientesTratadosAnioAnterior * 1.2;
        const cajaObjetivo = cajaAnioAnterior * 1.2;
        const pacientesCobradosObjetivo = pacientesCobradosAnioAnterior * 1.2;

        // --- Actualiza las tarjetas con updateCard ---
        updateCard({
            cardSelector: '#card-presupuestado',
            value: presupuestado,
            valueId: 'presupuestado-value',
            anioAnterior: presupuestadoAnioAnterior,
            anioAnteriorId: 'presupuestado-anio-anterior',
            objetivo: presupuestadoObjetivo,
            objetivoId: 'presupuestado-objetivo',
            isCurrency: true
        });
        updateCard({
            cardSelector: '#card-pacientes-comerciales',
            value: pacientesComerciales,
            valueId: 'pacientes-comerciales-value',
            anioAnterior: pacientesComercialesAnioAnterior,
            anioAnteriorId: 'pacientes-comerciales-anio-anterior',
            objetivo: pacientesComercialesObjetivo,
            objetivoId: 'pacientes-comerciales-objetivo'
        });
        // --- Cambia aquí: la barra usa el total del periodo, el valor grande usa el semanal por mes ---
        updateCard({
            cardSelector: '#card-aceptado',
            value: aceptadoTotalPeriodo, // Barra principal: suma total del periodo
            valueId: 'aceptado-value',
            anioAnterior: aceptadoAnioAnterior,
            anioAnteriorId: 'aceptado-anio-anterior',
            objetivo: aceptadoObjetivo,
            objetivoId: 'aceptado-objetivo',
            isCurrency: true
        });
        // Valor grande de la derecha (aceptado semanal por mes)
        const aceptadoSemanalElem = document.getElementById('aceptado-semanal-mes');
        if (aceptadoSemanalElem) {
            aceptadoSemanalElem.textContent = aceptadoSemanalPorMes.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
        }
        updateCard({
            cardSelector: '#card-pacientes-aceptados',
            value: pacientesAceptados,
            valueId: 'pacientes-aceptados-value',
            anioAnterior: pacientesAceptadosAnioAnterior,
            anioAnteriorId: 'pacientes-aceptados-anio-anterior',
            objetivo: pacientesAceptadosObjetivo,
            objetivoId: 'pacientes-aceptados-objetivo'
        });
        updateCard({
            cardSelector: '#card-produccion',
            value: produccion,
            valueId: 'produccion-value',
            anioAnterior: produccionAnioAnterior,
            anioAnteriorId: 'produccion-anio-anterior',
            objetivo: produccionObjetivo,
            objetivoId: 'produccion-objetivo',
            isCurrency: true
        });
        updateCard({
            cardSelector: '#card-pacientes-tratados',
            value: pacientesTratados,
            valueId: 'pacientes-tratados-value',
            anioAnterior: pacientesTratadosAnioAnterior,
            anioAnteriorId: 'pacientes-tratados-anio-anterior',
            objetivo: pacientesTratadosObjetivo,
            objetivoId: 'pacientes-tratados-objetivo'
        });
        updateCard({
            cardSelector: '#card-caja',
            value: caja,
            valueId: 'caja-value',
            anioAnterior: cajaAnioAnterior,
            anioAnteriorId: 'caja-anio-anterior',
            objetivo: cajaObjetivo,
            objetivoId: 'caja-objetivo',
            isCurrency: true
        });
        updateCard({
            cardSelector: '#card-pacientes-cobrados',
            value: pacientesCobrados,
            valueId: 'pacientes-cobrados-value',
            anioAnterior: pacientesCobradosAnioAnterior,
            anioAnteriorId: 'pacientes-cobrados-anio-anterior',
            objetivo: pacientesCobradosObjetivo,
            objetivoId: 'pacientes-cobrados-objetivo'
        });
    }

    function updateCard({ cardSelector, value, valueId, anioAnterior, anioAnteriorId, objetivo, objetivoId, isCurrency = false }) {
        const maxBar = Math.max(value, objetivo, anioAnterior, 1);
        const widthActual = (value / maxBar) * 100;
        const widthObjetivo = (objetivo / maxBar) * 100;
        const widthAnterior = (anioAnterior / maxBar) * 100;
        const card = document.querySelector(cardSelector);
        if (card) {
            card.querySelector('.bar.actual').style.width = widthActual + '%';
            card.querySelector('.bar.objetivo').style.width = widthObjetivo + '%';
            card.querySelector('.bar.anterior').style.width = widthAnterior + '%';

            card.querySelector('.bar-label.actual-label').textContent = isCurrency
                ? value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
                : value;
            card.querySelector('.bar-label.objetivo-label').textContent = isCurrency
                ? objetivo.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
                : objetivo;
            card.querySelector('.bar-label.anterior-label').textContent = isCurrency
                ? anioAnterior.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
                : anioAnterior;
        }
        document.getElementById(valueId).textContent = isCurrency ? value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : value;
        document.getElementById(anioAnteriorId).textContent = isCurrency ? anioAnterior.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : anioAnterior;
        document.getElementById(objetivoId).textContent = isCurrency ? objetivo.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : objetivo;
    }

    function getYearMonthWeek(fecha) {
        const d = new Date(fecha.split(' ')[0]);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const week = Math.ceil(d.getDate() / 7);
        return { year, month, week };
    }
}