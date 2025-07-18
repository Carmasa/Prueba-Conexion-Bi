// Inicializa la lógica de KPIs y dashboard
function inicializarCalculosGesden() {
    // --- Selectores de periodo ---
    const yearSelector = document.getElementById('yearSelector');
    const monthSelector = document.getElementById('monthSelector');
    const weekSelector = document.getElementById('weekSelector');
    const gestor = localStorage.getItem('gestor');

    let allRows = [];

    // --- Ruta del CSV según clínica seleccionada ---
    const clinica = localStorage.getItem('usuario');
    const csvPath = `dataSets${clinica}/Movimientos.csv`;

    // --- Eventos para actualizar el dashboard al cambiar selectores ---
    yearSelector.addEventListener('change', actualizarDashboard);
    monthSelector.addEventListener('change', actualizarDashboard);
    weekSelector.addEventListener('change', actualizarDashboard);

    // --- Carga inicial de datos ---
    cargarKPIs();

    // --- Función para cargar y parsear el CSV ---
    function cargarKPIs() {
        fetch(csvPath)
            .then(res => res.text())
            .then(csv => {
                // Parsear el CSV a objetos
                let rows = Papa.parse(csv, { header: true, delimiter: ';' }).data;
                allRows = rows;
                poblarSelectores(allRows);
                actualizarDashboard();
            });
    }

    // --- Pobla los selectores de año, mes y semana con los valores únicos del dataset ---
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

        // Selecciona por defecto el año, mes y semana actuales si existen en los datos
        const hoy = new Date();
        const { year, month, week } = getYearMonthWeek(hoy.toISOString().split('T')[0]);
        yearSelector.value = años.has(year) ? year : 'todos';
        monthSelector.value = meses.has(month) ? month : 'todos';
        weekSelector.value = semanas.has(week) ? week : 'todos';
    }

    // --- Refresca el dashboard filtrando los datos según los selectores ---
    function actualizarDashboard() {
        let rows = allRows;
        const year = yearSelector.value;
        const month = monthSelector.value;
        const week = weekSelector.value;

        // Filtra por año, mes y semana seleccionados
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

    // --- Cálculo y actualización de todos los KPIs y objetivos ---
    function mostrarKPIs(rows) {
        // --- Variables de periodo seleccionadas ---
        const year = yearSelector.value;
        const month = monthSelector.value;
        const week = weekSelector.value;
        const yearActual = year !== 'todos' ? parseInt(year) : new Date().getFullYear();
        const yearAnterior = year !== 'todos' ? (parseInt(year) - 1) : null;

        // --- Filtra filas del año anterior, mes y semana seleccionados ---
        const rowsAnioAnteriorMesSemana = allRows.filter(r => {
            const fecha = r['FechaPresupuesto'] || r['Fecha'] || r['Presupuesto Fecha'];
            if (!fecha) return false;
            const { year: y, month: m, week: w } = getYearMonthWeek(fecha);
            return (yearAnterior ? y == yearAnterior : true) &&
                (month === 'todos' || m == month) &&
                (week === 'todos' || w == week);
        });

        // --- Medidas principales ---
        // Número de actos (actual)
        let numActos;
        if (gestor === 'gesden') {
            numActos = rows
                .filter(r => r['IdEstadoTratamiento'] == 5)
                .reduce((sum, r) => sum + parseFloat((r['Actos'] || '0').replace(',', '.')), 0);
        } else if (gestor === 'odontonet') {
            numActos = rows
                .reduce((sum, r) => sum + parseFloat((r['Actos'] || '0').replace(',', '.')), 0);
        }
        // Número de meses distintos en el filtro del año anterior
        const mesesFiltrados = new Set(rowsAnioAnteriorMesSemana.map(r => {
            const fecha = r['FechaPresupuesto'] || r['Fecha'] || r['Presupuesto Fecha'];
            if (!fecha) return null;
            return getYearMonthWeek(fecha).month;
        }).filter(Boolean));
        const numMeses = mesesFiltrados.size || 1;

        // Euros Producción (actual)
        const eurosProduccion = rows
            .filter(r => r['IdEstadoTratamiento'] == 4 || r['IdEstadoTratamiento'] == 5)
            .reduce((sum, r) => sum + parseFloat((r['ImporteProducido'] || '0').replace(',', '.')), 0);

        // Euros Producción año anterior (mes y semana actual)
        const eurosProduccionAnioAnterior = rowsAnioAnteriorMesSemana
            .filter(r => r['IdEstadoTratamiento'] == 4 || r['IdEstadoTratamiento'] == 5)
            .reduce((sum, r) => sum + parseFloat((r['ImporteProducido'] || '0').replace(',', '.')), 0);

        // Número de actos año anterior (mes y semana actual)
        const numeroActosAnioAnterior = rowsAnioAnteriorMesSemana
            .filter(r => r['IdEstadoTratamiento'] == 5)
            .reduce((sum, r) => sum + parseFloat((r['Actos'] || '0').replace(',', '.')), 0);

        // --- Ticket Medio por Acto Año Anterior ---
        let ticketMedioPorActoAnioAnterior;
        if (gestor === 'gesden') {
            const eurosProduccionAnioAnterior = rowsAnioAnteriorMesSemana
                .filter(r => r['IdEstadoTratamiento'] == 4 || r['IdEstadoTratamiento'] == 5)
                .reduce((sum, r) => sum + parseFloat((r['ImporteProducido'] || '0').replace(',', '.')), 0);

            const numeroActosAnioAnterior = rowsAnioAnteriorMesSemana
                .filter(r => r['IdEstadoTratamiento'] == 5)
                .reduce((sum, r) => sum + parseFloat((r['Actos'] || '0').replace(',', '.')), 0);

            ticketMedioPorActoAnioAnterior = numeroActosAnioAnterior !== 0
                ? (eurosProduccionAnioAnterior / numeroActosAnioAnterior)
                : 0;
        } else if (gestor === 'odontonet') {
            const eurosProduccionAnioAnterior = rowsAnioAnteriorMesSemana
                .reduce((sum, r) => sum + parseFloat((r['ImporteProducido'] || '0').replace(',', '.')), 0);

            const numeroActosAnioAnterior = rowsAnioAnteriorMesSemana
                .reduce((sum, r) => sum + parseFloat((r['Actos'] || '0').replace(',', '.')), 0);

            ticketMedioPorActoAnioAnterior = numeroActosAnioAnterior !== 0
                ? (eurosProduccionAnioAnterior / numeroActosAnioAnterior)
                : 0;
        }

        // Producción filtrada (año anterior, mes y semana seleccionados)
        const produccionFiltrada = eurosProduccionAnioAnterior;

        // Actos Mensuales Superavit 1
        const actosMensualesSuperavit1 = ticketMedioPorActoAnioAnterior !== 0
            ? (produccionFiltrada / numMeses) / ticketMedioPorActoAnioAnterior
            : 0;

        // Crecimiento (ajusta si lo tomas de una tabla)
        const crecimientoSuperavitNivel2 = 0.12;

        // Actos Mensuales Superavit 2
        const actosMensualesSuperavit2 = actosMensualesSuperavit1 * (1 + crecimientoSuperavitNivel2);

        // Producción Superavit 2
        const produccionSuperavit2 = actosMensualesSuperavit2 * ticketMedioPorActoAnioAnterior;

        // Euros aceptados (actual)
        const eurosAceptados = rows.reduce((sum, r) =>
            sum + parseFloat((r['ImportePresupuestadoAceptado'] || '0').replace(',', '.')), 0);


        // Euros aceptados año anterior (mes y semana actual)
        const eurosAceptadosAnioAnterior = rowsAnioAnteriorMesSemana.reduce((sum, r) =>
            sum + parseFloat((r['ImportePresupuestadoAceptado'] || '0').replace(',', '.')), 0);

        // % Producción/Aceptados (Ratio del año anterior, filtrado por año anterior, mes y semana)
        let ratioProduccionAceptados = eurosAceptadosAnioAnterior !== 0
            ? eurosProduccionAnioAnterior / eurosAceptadosAnioAnterior
            : 0;
        ratioProduccionAceptados = Math.max(0.65, Math.min(0.8, ratioProduccionAceptados));

        // Aceptados Mensual Objetivo
        const aceptadosMensualObjetivo = ratioProduccionAceptados !== 0
            ? produccionSuperavit2 / ratioProduccionAceptados
            : 0;

        // Euros presupuestado (actual)
        const eurosPresupuestado = rows.reduce((sum, r) =>
            sum + parseFloat((r['Presupuestado'] || '0').replace(',', '.')), 0);

        // % Aceptados/Presentados (año anterior)
        let porcentajeAceptadosPresentados = eurosPresupuestado !== 0
            ? (eurosAceptados / eurosPresupuestado) + 0.05
            : 0.05;

        // Filtra solo por el mes seleccionado (sin filtrar por semana)
        const rowsMes = rows.filter(r => {
            const fecha = r['FechaPresupuesto'] || r['Fecha'] || r['Presupuesto Fecha'];
            if (!fecha) return false;
            const { month: m } = getYearMonthWeek(fecha);
            return (month === 'todos' || m == month);
        });

        // Cuenta semanas distintas en el mes filtrado
        const semanasFiltradas = new Set(rowsMes.map(r => {
            const fecha = r['FechaPresupuesto'] || r['Fecha'] || r['Presupuesto Fecha'];
            if (!fecha) return null;
            return getYearMonthWeek(fecha).week;
        }).filter(Boolean));
        const numSemanasMes = semanasFiltradas.size || 1;

        // Presentados Mensual Objetivo
        const presentadosMensualObjetivo = porcentajeAceptadosPresentados !== 0
            ? aceptadosMensualObjetivo / porcentajeAceptadosPresentados
            : 0;

        // Presentados Semanal Objetivo
        const presentadosSemanalObjetivo = numSemanasMes !== 0
            ? presentadosMensualObjetivo / numSemanasMes
            : 0;


        // Calculos de objetivos de producción
        const produccionMensualObjetivo = produccionSuperavit2;
        const produccionSemanalObjetivo = numSemanasMes !== 0
            ? produccionMensualObjetivo / numSemanasMes
            : 0;

        // --- CÁLCULO DE OBJETIVO ACEPTADOS ---
        // Usamos las mismas variables que el bloque presupuestado

        // Actos Mensuales Superavit 1 (ya calculado arriba)

        // Actos Mensuales Superavit 2
        const actosMensualesSuperavit2Aceptados = actosMensualesSuperavit1 * (1 + crecimientoSuperavitNivel2);

        // Producción Superavit 2
        const produccionSuperavit2Aceptados = actosMensualesSuperavit2Aceptados * ticketMedioPorActoAnioAnterior;

        // Producción Mensual Objetivo
        const produccionMensualObjetivoAceptados = produccionSuperavit2Aceptados;

        // Aceptados Mensual Objetivo
        const aceptadosMensualObjetivoFinal = ratioProduccionAceptados !== 0
            ? produccionMensualObjetivoAceptados / ratioProduccionAceptados
            : 0;

        // Aceptados Semanal Objetivo
        const aceptadosSemanalObjetivo = numSemanasMes !== 0
            ? aceptadosMensualObjetivoFinal / numSemanasMes
            : 0;

        // --- CÁLCULO DE OBJETIVO CAJA ---
        // Cobrado (€) año anterior (mes y semana actual)
        const eurosCobradoAnioAnterior = rowsAnioAnteriorMesSemana.reduce((sum, r) =>
            sum + parseFloat((r['ImportePagado'] || '0').replace(',', '.')), 0);

        // % Producción/Caja (Ratio del año anterior, filtrado por año anterior, mes y semana)
        let ratioProduccionCaja = eurosCobradoAnioAnterior !== 0
            ? eurosProduccionAnioAnterior / eurosCobradoAnioAnterior
            : 0;
        ratioProduccionCaja = Math.max(0.65, Math.min(1, ratioProduccionCaja));


        // Caja Mensual Objetivo
        const cajaMensualObjetivo = ratioProduccionCaja !== 0
            ? produccionSuperavit2 / ratioProduccionCaja
            : 0;

        // Caja Semanal Objetivo
        const cajaSemanalObjetivo = numSemanasMes !== 0
            ? cajaMensualObjetivo / numSemanasMes
            : 0;


        //PACIENTES
        // Calculo objetivos pacientes comerciales
        const comercialesSet = new Set(
            rows
                .filter(r => r['_Presupuesto'] == 1 && r['IdPac'] && r['IdPac'].trim() !== '')
                .map(r => r['IdPac'].trim())
        );
        const pacientesComerciales = comercialesSet.size;

        const ticketPacienteComercial = eurosPresupuestado / pacientesComerciales;

        const comercialesSemanalObjetivo = ticketPacienteComercial !== 0
            ? presentadosSemanalObjetivo / ticketPacienteComercial
            : 0;

        // Calculo objetivos pacientes aceptados
        let estadosAceptados;

        if (gestor === 'gesden') {
            estadosAceptados = [3, 4, 5];
        } else if (gestor === 'odontonet') {
            estadosAceptados = [1, 2, 4];
        } else {
            estadosAceptados = [3, 4, 5];
        }

        const aceptadosSet = new Set(
            rows
                .filter(r =>
                    estadosAceptados.includes(Number(r['IdEstadoPresupuesto'])) && r['IdPac'] && r['IdPac'].trim() !== '')
                .map(r => r['IdPac'].trim())
        );
        const pacientesAceptados = aceptadosSet.size;

        const ticketPacienteAceptado = eurosAceptados / pacientesAceptados;

        const aceptadosSemanalObjetivo2 = ticketPacienteAceptado !== 0
            ? aceptadosSemanalObjetivo / ticketPacienteAceptado
            : 0;

        //Calculo objetivos pacientes tratados
        let tratadosSet;

        if (gestor === 'gesden') {
            // Gesden: lógica completa
            tratadosSet = new Set(
                rows
                    .filter(r =>
                        r['IdTratamientoMedico'] && r['IdTratamientoMedico'].trim() !== '' &&
                        (r['Tipo Movimiento'] || '').trim() === 'Produccion Lineas' &&
                        parseFloat((r['ImporteProducido'] || '0').replace(',', '.')) !== 0 &&
                        r['IdPac'] && r['IdPac'].trim() !== ''
                    )
                    .map(r => r['IdPac'].trim())
            );
        } else if (gestor === 'odontonet') {
            // Odontonet: solo IdTratamientoMedico no vacío
            tratadosSet = new Set(
                rows
                    .filter(r =>
                        r['IdTratamientoMedico'] && r['IdTratamientoMedico'].trim() !== '' &&
                        r['IdPac'] && r['IdPac'].trim() !== ''
                    )
                    .map(r => r['IdPac'].trim())
            );
        } else {
            // Por defecto Gesden
            tratadosSet = new Set(
                rows
                    .filter(r =>
                        r['IdTratamientoMedico'] && r['IdTratamientoMedico'].trim() !== '' &&
                        (r['Tipo Movimiento'] || '').trim() === 'Produccion Lineas' &&
                        parseFloat((r['ImporteProducido'] || '0').replace(',', '.')) !== 0 &&
                        r['IdPac'] && r['IdPac'].trim() !== ''
                    )
                    .map(r => r['IdPac'].trim())
            );
        }

        const pacientesTratados = tratadosSet.size;

        const ticketPacienteProduccion = eurosProduccion / pacientesTratados;

        const tratadosSemanalObjetivo = ticketPacienteProduccion !== 0
            ? produccionSemanalObjetivo / ticketPacienteProduccion
            : 0;


        // --- CÁLCULO DE OBJETIVO PACIENTES Cobrados ---

        // Número Pacientes Cobro (DISTINCTCOUNT de IdPac donde Movimiento = "Caja" en el filtro principal)
        const cobradosSet = new Set(
            rows
                .filter(r => (r['Movimiento'] || '').trim() === 'Caja' && r['IdPac'] && r['IdPac'].trim() !== '')
                .map(r => r['IdPac'].trim())
        );

        const pacientesCobrados = cobradosSet.size;

        // Ticket Paciente Caja = SUM(ImportePagado donde Movimiento = "Caja" en el filtro principal) / pacientesCobrados
        const eurosCobrados = rows
            .filter(r => (r['Movimiento'] || '').trim() === 'Caja')
            .reduce((sum, r) => sum + parseFloat((r['ImportePagado'] || '0').replace(',', '.')), 0);

        const ticketPacienteCaja = pacientesCobrados !== 0
            ? eurosCobrados / pacientesCobrados
            : 0;

        // Pacientes Cobrados OS
        const cobradoSemanalObjetivo = ticketPacienteCaja !== 0
            ? cajaSemanalObjetivo / ticketPacienteCaja
            : 0;


        // --- MOSTRAR EN HTML ---

        // --- INGRESOS ---
        // PRESUPUESTADO
        const presupuestadoAnioAnterior = rowsAnioAnteriorMesSemana.reduce((sum, r) => sum + parseFloat((r['Presupuestado'] || '0').replace(',', '.')), 0);
        // ACEPTADO
        const rowsAceptados = allRows.filter(r => {
            const fecha = r['Fecha'];
            if (!fecha) return false;
            const { year: y, month: m, week: w } = getYearMonthWeek(fecha);
            return (year === 'todos' || y == year) &&
                (month === 'todos' || m == month) &&
                (week === 'todos' || w == week);
        });
        const aceptado = rowsAceptados.reduce((sum, r) =>
            sum + parseFloat((r['ImportePresupuestadoAceptado_FechaAceptacion'] || '0').replace(',', '.')), 0);

        const rowsAceptadosAnioAnterior = allRows.filter(r => {
            const fecha = r['Fecha'];
            if (!fecha) return false;
            const { year: y, month: m, week: w } = getYearMonthWeek(fecha);
            return (year !== 'todos' && y == (parseInt(year) - 1)) &&
                (month === 'todos' || m == month) &&
                (week === 'todos' || w == week);
        });
        const aceptadoAnioAnterior = rowsAceptadosAnioAnterior.reduce((sum, r) =>
            sum + parseFloat((r['ImportePresupuestadoAceptado_FechaAceptacion'] || '0').replace(',', '.')), 0);



        // PRODUCCIÓN
        const produccion = rows.filter(r =>
            r['IdEstadoTratamiento'] == 4 || r['IdEstadoTratamiento'] == 5
        ).reduce((sum, r) => sum + parseFloat((r['ImporteProducido'] || '0').replace(',', '.')), 0);
        const rowsProduccionAnioAnterior = allRows.filter(r => {
            const fecha = r['Fecha'];
            if (!fecha) return false;
            const { year: y, month: m, week: w } = getYearMonthWeek(fecha);
            return (year !== 'todos' && y == (parseInt(year) - 1)) &&
                (month === 'todos' || m == month) &&
                (week === 'todos' || w == week);
        });
        const produccionAnioAnterior = rowsProduccionAnioAnterior
            .filter(r => r['IdEstadoTratamiento'] == 4 || r['IdEstadoTratamiento'] == 5)
            .reduce((sum, r) => sum + parseFloat((r['ImporteProducido'] || '0').replace(',', '.')), 0);
        const produccionObjetivo = produccionAnioAnterior * 1.1;

        // CAJA
        const caja = rows.reduce((sum, r) => sum + parseFloat((r['ImportePagado'] || '0').replace(',', '.')), 0);
        const cajaAnioAnterior = rowsAnioAnteriorMesSemana.reduce((sum, r) => sum + parseFloat((r['ImportePagado'] || '0').replace(',', '.')), 0);
        const cajaObjetivo = cajaAnioAnterior * 1.1;

        // --- DIFERENCIAS INGRESOS ---
        const difPresupuestadoAnio = eurosPresupuestado - presupuestadoAnioAnterior;
        const difPresupuestadoObjetivo = eurosPresupuestado - presentadosSemanalObjetivo;
        const difAceptadoAnio = aceptado - aceptadoAnioAnterior;
        const difAceptadoObjetivo = aceptado - aceptadosSemanalObjetivo;
        const difProduccionAnio = produccion - produccionAnioAnterior;
        const difProduccionObjetivo = eurosProduccion - produccionSemanalObjetivo;
        const difCajaAnio = caja - cajaAnioAnterior;
        const difCajaObjetivo = eurosCobrados - cajaSemanalObjetivo;

        //tasa evolucion ingreso
        const tasaEvolucionPresu = (difPresupuestadoAnio / presupuestadoAnioAnterior);
        const tasaEvolucionProdu = (difProduccionAnio / produccionAnioAnterior);
        const tasaEvolucionAcep = (difAceptadoAnio / aceptadoAnioAnterior);
        const tasaEvolucionCaja = (difCajaAnio / cajaAnioAnterior);

        // alcance objetivo ingresos
        const alcancePresu = (eurosPresupuestado / presentadosSemanalObjetivo) - 1;
        const alcanceProdu = (eurosProduccion / produccionSemanalObjetivo) - 1;
        const alcanceAcep = (aceptado / aceptadosSemanalObjetivo) - 1;
        const alcanceCaja = (eurosCobrados / cajaSemanalObjetivo) - 1;



        // --- PACIENTES ---
        // PACIENTES COMERCIALES
        const comercialesSetAnioAnterior = new Set(
            rowsAnioAnteriorMesSemana
                .filter(r => r['_Presupuesto'] == 1 && r['IdPac'] && r['IdPac'].trim() !== '')
                .map(r => r['IdPac'].trim())
        );
        const pacientesComercialesAnioAnterior = comercialesSetAnioAnterior.size;
        const pacientesComercialesObjetivo = pacientesComercialesAnioAnterior * 1.1;

        // PACIENTES ACEPTADOS

        const aceptadosSetAnioAnterior = new Set(
            rowsAnioAnteriorMesSemana
                .filter(r => [3, 4, 5].includes(Number(r['IdEstadoPresupuesto'])) && r['IdPac'] && r['IdPac'].trim() !== '')
                .map(r => r['IdPac'].trim())
        );
        const pacientesAceptadosAnioAnterior = aceptadosSetAnioAnterior.size;
        const pacientesAceptadosObjetivo = pacientesAceptadosAnioAnterior * 1.1;


        let tratadosSetAnioAnterior;

        if (gestor === 'gesden') {
            tratadosSetAnioAnterior = new Set(
                rowsAnioAnteriorMesSemana
                    .filter(r =>
                        r['IdTratamientoMedico'] && r['IdTratamientoMedico'].trim() !== '' &&
                        (r['Tipo Movimiento'] || '').trim() === 'Produccion Lineas' &&
                        parseFloat((r['ImporteProducido'] || '0').replace(',', '.')) !== 0 &&
                        r['IdPac'] && r['IdPac'].trim() !== ''
                    )
                    .map(r => r['IdPac'].trim())
            );
        } else if (gestor === 'odontonet') {
            tratadosSetAnioAnterior = new Set(
                rowsAnioAnteriorMesSemana
                    .filter(r =>
                        r['IdTratamientoMedico'] && r['IdTratamientoMedico'].trim() !== '' &&
                        r['IdPac'] && r['IdPac'].trim() !== ''
                    )
                    .map(r => r['IdPac'].trim())
            );
        } else {
            tratadosSetAnioAnterior = new Set(
                rowsAnioAnteriorMesSemana
                    .filter(r =>
                        r['IdTratamientoMedico'] && r['IdTratamientoMedico'].trim() !== '' &&
                        (r['Tipo Movimiento'] || '').trim() === 'Produccion Lineas' &&
                        parseFloat((r['ImporteProducido'] || '0').replace(',', '.')) !== 0 &&
                        r['IdPac'] && r['IdPac'].trim() !== ''
                    )
                    .map(r => r['IdPac'].trim())
            );
        }

        const pacientesTratadosAnioAnterior = tratadosSetAnioAnterior.size;
        const pacientesTratadosObjetivo = pacientesTratadosAnioAnterior * 1.1;

        // PACIENTES COBRADOS
        const cobradosSetAnioAnterior = new Set(
            rowsAnioAnteriorMesSemana
                .filter(r => (r['Movimiento'] || '').trim() === 'Caja' && r['IdPac'] && r['IdPac'].trim() !== '')
                .map(r => r['IdPac'].trim())
        );
        const pacientesCobradosAnioAnterior = cobradosSetAnioAnterior.size;
        const pacientesCobradosObjetivo = pacientesCobradosAnioAnterior * 1.1;

        // --- DIFERENCIAS PACIENTES ---
        const difComercialesAnio = pacientesComerciales - pacientesComercialesAnioAnterior;
        const difComercialesObjetivo = pacientesComerciales - comercialesSemanalObjetivo;
        const difAceptadosAnio = pacientesAceptados - pacientesAceptadosAnioAnterior;
        const difAceptadosObjetivo = pacientesAceptados - aceptadosSemanalObjetivo2;
        const difTratadosAnio = pacientesTratados - pacientesTratadosAnioAnterior;
        const difTratadosObjetivo = pacientesTratados - tratadosSemanalObjetivo;
        const difCobradosAnio = pacientesCobrados - pacientesCobradosAnioAnterior;
        const difCobradosObjetivo = pacientesCobrados - cobradoSemanalObjetivo;

        //Tasa evolucion pacientes
        const tasaEvolucionComerciales = (difComercialesAnio / pacientesComercialesAnioAnterior);
        const tasaEvolucionAceptados = (difAceptadosAnio / pacientesAceptadosAnioAnterior);
        const tasaEvolucionTratados = (difTratadosAnio / pacientesTratadosAnioAnterior);
        const tasaEvolucionCobrados = (difCobradosAnio / pacientesCobradosAnioAnterior);

        // Alcance objetivo pacientes
        const alcanceComerciales = (pacientesComerciales / comercialesSemanalObjetivo) - 1;
        const alcanceAceptados = (pacientesAceptados / aceptadosSemanalObjetivo2) - 1;
        const alcanceTratados = (pacientesTratados / tratadosSemanalObjetivo) - 1;
        const alcanceCobrados = (pacientesCobrados / cobradoSemanalObjetivo) - 1;


        // --- MOSTRAR EN HTML ---
        // INGRESOS
        if (document.getElementById('presupuestado-value')) document.getElementById('presupuestado-value').textContent = eurosPresupuestado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
        if (document.getElementById('presupuestado-anio-anterior')) document.getElementById('presupuestado-anio-anterior').textContent = presupuestadoAnioAnterior.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
        if (document.getElementById('presupuestado-objetivo')) document.getElementById('presupuestado-objetivo').textContent = presentadosSemanalObjetivo.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
        if (document.getElementById('presupuestado-dif-anio')) document.getElementById('presupuestado-dif-anio').textContent = (difPresupuestadoAnio > 0 ? '+' : '') + difPresupuestadoAnio.toLocaleString('es-ES', { maximumFractionDigits: 0 });
        if (document.getElementById('presupuestado-dif-objetivo')) document.getElementById('presupuestado-dif-objetivo').textContent = difPresupuestadoObjetivo.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
        if (document.getElementById('tasa-presupuestado-evolucion')) document.getElementById('tasa-presupuestado-evolucion').textContent = tasaEvolucionPresu.toLocaleString('es-ES', { style: 'percent', minimumFractionDigits: 2 });
        if (document.getElementById('alcance-presupuestado')) document.getElementById('alcance-presupuestado').textContent = alcancePresu.toLocaleString('es-ES', { style: 'percent', minimumFractionDigits: 2 });

        if (document.getElementById('aceptado-value')) document.getElementById('aceptado-value').textContent = aceptado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
        if (document.getElementById('aceptado-anio-anterior')) document.getElementById('aceptado-anio-anterior').textContent = aceptadoAnioAnterior.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
        if (document.getElementById('aceptado-objetivo')) document.getElementById('aceptado-objetivo').textContent = aceptadosSemanalObjetivo.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
        if (document.getElementById('aceptado-dif-anio')) document.getElementById('aceptado-dif-anio').textContent = (difAceptadoAnio > 0 ? '+' : '') + difAceptadoAnio.toLocaleString('es-ES', { maximumFractionDigits: 0 });
        if (document.getElementById('aceptado-dif-objetivo')) document.getElementById('aceptado-dif-objetivo').textContent = (difAceptadoObjetivo > 0 ? '+' : '') + difAceptadoObjetivo.toLocaleString('es-ES', { maximumFractionDigits: 0 });
        if (document.getElementById('tasa-aceptado-evolucion')) document.getElementById('tasa-aceptado-evolucion').textContent = tasaEvolucionAcep.toLocaleString('es-ES', { style: 'percent', minimumFractionDigits: 2 });
        if (document.getElementById('alcance-aceptado')) document.getElementById('alcance-aceptado').textContent = alcanceAcep.toLocaleString('es-ES', { style: 'percent', minimumFractionDigits: 2 });

        if (document.getElementById('produccion-value')) document.getElementById('produccion-value').textContent = produccion.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
        if (document.getElementById('produccion-anio-anterior')) document.getElementById('produccion-anio-anterior').textContent = produccionAnioAnterior.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
        if (document.getElementById('produccion-objetivo')) document.getElementById('produccion-objetivo').textContent = produccionSemanalObjetivo.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
        if (document.getElementById('produccion-dif-anio')) document.getElementById('produccion-dif-anio').textContent = (difProduccionAnio > 0 ? '+' : '') + difProduccionAnio.toLocaleString('es-ES', { maximumFractionDigits: 0 });
        if (document.getElementById('produccion-dif-objetivo')) document.getElementById('produccion-dif-objetivo').textContent = (difProduccionObjetivo > 0 ? '+' : '') + difProduccionObjetivo.toLocaleString('es-ES', { maximumFractionDigits: 0 });
        if (document.getElementById('tasa-produccion-evolucion')) document.getElementById('tasa-produccion-evolucion').textContent = tasaEvolucionProdu.toLocaleString('es-ES', { style: 'percent', minimumFractionDigits: 2 });
        if (document.getElementById('alcance-produccion')) document.getElementById('alcance-produccion').textContent = alcanceProdu.toLocaleString('es-ES', { style: 'percent', minimumFractionDigits: 2 });

        if (document.getElementById('caja-value')) document.getElementById('caja-value').textContent = caja.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
        if (document.getElementById('caja-anio-anterior')) document.getElementById('caja-anio-anterior').textContent = cajaAnioAnterior.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
        if (document.getElementById('caja-objetivo')) document.getElementById('caja-objetivo').textContent = cajaSemanalObjetivo.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
        if (document.getElementById('caja-dif-anio')) document.getElementById('caja-dif-anio').textContent = (difCajaAnio > 0 ? '+' : '') + difCajaAnio.toLocaleString('es-ES', { maximumFractionDigits: 0 });
        if (document.getElementById('caja-dif-objetivo')) document.getElementById('caja-dif-objetivo').textContent = (difCajaObjetivo > 0 ? '+' : '') + difCajaObjetivo.toLocaleString('es-ES', { maximumFractionDigits: 0 });
        if (document.getElementById('tasa-caja-evolucion')) document.getElementById('tasa-caja-evolucion').textContent = tasaEvolucionCaja.toLocaleString('es-ES', { style: 'percent', minimumFractionDigits: 2 });
        if (document.getElementById('alcance-caja')) document.getElementById('alcance-caja').textContent = alcanceCaja.toLocaleString('es-ES', { style: 'percent', minimumFractionDigits: 2 });

        // PACIENTES
        if (document.getElementById('pacientes-comerciales-value')) document.getElementById('pacientes-comerciales-value').textContent = pacientesComerciales;
        if (document.getElementById('pacientes-comerciales-anio-anterior')) document.getElementById('pacientes-comerciales-anio-anterior').textContent = pacientesComercialesAnioAnterior;
        if (document.getElementById('pacientes-comerciales-objetivo')) document.getElementById('pacientes-comerciales-objetivo').textContent = comercialesSemanalObjetivo.toFixed(0);
        if (document.getElementById('pacientes-comerciales-dif-anio')) document.getElementById('pacientes-comerciales-dif-anio').textContent = (difComercialesAnio > 0 ? '+' : '') + difComercialesAnio;
        if (document.getElementById('pacientes-comerciales-dif-objetivo')) document.getElementById('pacientes-comerciales-dif-objetivo').textContent = (difComercialesObjetivo > 0 ? '+' : '') + difComercialesObjetivo.toLocaleString('es-ES', { maximumFractionDigits: 0 });
        if (document.getElementById('tasa-comerciales-evolucion')) document.getElementById('tasa-comerciales-evolucion').textContent = tasaEvolucionComerciales.toLocaleString('es-ES', { style: 'percent', minimumFractionDigits: 2 });
        if (document.getElementById('alcance-comerciales')) document.getElementById('alcance-comerciales').textContent = alcanceComerciales.toLocaleString('es-ES', { style: 'percent', minimumFractionDigits: 2 });

        if (document.getElementById('pacientes-aceptados-value')) document.getElementById('pacientes-aceptados-value').textContent = pacientesAceptados;
        if (document.getElementById('pacientes-aceptados-anio-anterior')) document.getElementById('pacientes-aceptados-anio-anterior').textContent = pacientesAceptadosAnioAnterior;
        if (document.getElementById('pacientes-aceptados-objetivo')) document.getElementById('pacientes-aceptados-objetivo').textContent = aceptadosSemanalObjetivo2.toFixed(0);
        if (document.getElementById('pacientes-aceptados-dif-anio')) document.getElementById('pacientes-aceptados-dif-anio').textContent = (difAceptadosAnio > 0 ? '+' : '') + difAceptadosAnio;
        if (document.getElementById('pacientes-aceptados-dif-objetivo')) document.getElementById('pacientes-aceptados-dif-objetivo').textContent = (difAceptadosObjetivo > 0 ? '+' : '') + difAceptadosObjetivo.toLocaleString('es-ES', { maximumFractionDigits: 0 });
        if (document.getElementById('tasa-aceptados-evolucion')) document.getElementById('tasa-aceptados-evolucion').textContent = tasaEvolucionAceptados.toLocaleString('es-ES', { style: 'percent', minimumFractionDigits: 2 });
        if (document.getElementById('alcance-aceptados')) document.getElementById('alcance-aceptados').textContent = alcanceAceptados.toLocaleString('es-ES', { style: 'percent', minimumFractionDigits: 2 });

        if (document.getElementById('pacientes-tratados-value')) document.getElementById('pacientes-tratados-value').textContent = pacientesTratados;
        if (document.getElementById('pacientes-tratados-anio-anterior')) document.getElementById('pacientes-tratados-anio-anterior').textContent = pacientesTratadosAnioAnterior;
        if (document.getElementById('pacientes-tratados-objetivo')) document.getElementById('pacientes-tratados-objetivo').textContent = tratadosSemanalObjetivo.toFixed(0);
        if (document.getElementById('pacientes-tratados-dif-anio')) document.getElementById('pacientes-tratados-dif-anio').textContent = (difTratadosAnio > 0 ? '+' : '') + difTratadosAnio;
        if (document.getElementById('pacientes-tratados-dif-objetivo')) document.getElementById('pacientes-tratados-dif-objetivo').textContent = (difTratadosObjetivo > 0 ? '+' : '') + difTratadosObjetivo.toLocaleString('es-ES', { maximumFractionDigits: 0 });
        if (document.getElementById('tasa-tratados-evolucion')) document.getElementById('tasa-tratados-evolucion').textContent = tasaEvolucionTratados.toLocaleString('es-ES', { style: 'percent', minimumFractionDigits: 2 });
        if (document.getElementById('alcance-tratados')) document.getElementById('alcance-tratados').textContent = alcanceTratados.toLocaleString('es-ES', { style: 'percent', minimumFractionDigits: 2 });

        if (document.getElementById('pacientes-cobrados-value')) document.getElementById('pacientes-cobrados-value').textContent = pacientesCobrados;
        if (document.getElementById('pacientes-cobrados-anio-anterior')) document.getElementById('pacientes-cobrados-anio-anterior').textContent = pacientesCobradosAnioAnterior;
        if (document.getElementById('pacientes-cobrados-objetivo')) document.getElementById('pacientes-cobrados-objetivo').textContent = cobradoSemanalObjetivo.toFixed(0);
        if (document.getElementById('pacientes-cobrados-dif-anio')) document.getElementById('pacientes-cobrados-dif-anio').textContent = (difCobradosAnio > 0 ? '+' : '') + difCobradosAnio.toLocaleString('es-ES', { maximumFractionDigits: 0 });
        if (document.getElementById('pacientes-cobrados-dif-objetivo')) document.getElementById('pacientes-cobrados-dif-objetivo').textContent = (difCobradosObjetivo > 0 ? '+' : '') + difCobradosObjetivo.toLocaleString('es-ES', { maximumFractionDigits: 0 });
        if (document.getElementById('tasa-cobrados-evolucion')) document.getElementById('tasa-cobrados-evolucion').textContent = tasaEvolucionCobrados.toLocaleString('es-ES', { style: 'percent', minimumFractionDigits: 2 });
        if (document.getElementById('alcance-cobrados')) document.getElementById('alcance-cobrados').textContent = alcanceCobrados.toLocaleString('es-ES', { style: 'percent', minimumFractionDigits: 2 });

        // --- PACIENTES COMERCIALES ---
        let primeraComerciales = 0, fielesComerciales = 0;
        comercialesSet.forEach(id => {
            const row = rows.find(r => r['IdPac'] && r['IdPac'].trim() === id);
            if (row) {
                if (row['IdTipoPaciente'] === '1') primeraComerciales++;
                else if (row['IdTipoPaciente'] === '2') fielesComerciales++;
            }
        });
        if (document.getElementById('pacientes-comerciales-primera')) document.getElementById('pacientes-comerciales-primera').textContent = primeraComerciales;
        if (document.getElementById('pacientes-comerciales-fieles')) document.getElementById('pacientes-comerciales-fieles').textContent = fielesComerciales;

        // Ticket medio comercial
        const eurosPresupuestadoComercial = rows
            .filter(r => r['_Presupuesto'] == 1)
            .reduce((sum, r) => sum + parseFloat((r['Presupuestado'] || '0').replace(',', '.')), 0);
        const ticketMedioComercial = pacientesComerciales !== 0 ? eurosPresupuestadoComercial / pacientesComerciales : 0;
        if (document.getElementById('pacientes-comerciales-ticket')) document.getElementById('pacientes-comerciales-ticket').textContent = ticketMedioComercial.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

        // --- PACIENTES ACEPTADOS ---
        let primeraAceptados = 0, fielesAceptados = 0;
        aceptadosSet.forEach(id => {
            const row = rows.find(r => r['IdPac'] && r['IdPac'].trim() === id);
            if (row) {
                if (row['IdTipoPaciente'] === '1') primeraAceptados++;
                else if (row['IdTipoPaciente'] === '2') fielesAceptados++;
            }
        });
        if (document.getElementById('pacientes-aceptados-primera')) document.getElementById('pacientes-aceptados-primera').textContent = primeraAceptados;
        if (document.getElementById('pacientes-aceptados-fieles')) document.getElementById('pacientes-aceptados-fieles').textContent = fielesAceptados;



        // Ticket medio aceptados
        const ticketMedioAceptados = pacientesAceptados !== 0 ? eurosAceptados / pacientesAceptados : 0;
        if (document.getElementById('pacientes-aceptados-ticket')) document.getElementById('pacientes-aceptados-ticket').textContent = ticketMedioAceptados.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

        // --- PACIENTES TRATADOS ---
        let primeraTratados = 0, fielesTratados = 0;
        tratadosSet.forEach(id => {
            const row = rows.find(r => r['IdPac'] && r['IdPac'].trim() === id);
            if (row) {
                if (row['IdTipoPaciente'] === '1') primeraTratados++;
                else if (row['IdTipoPaciente'] === '2') fielesTratados++;
            }
        });
        if (document.getElementById('pacientes-tratados-primera')) document.getElementById('pacientes-tratados-primera').textContent = primeraTratados;
        if (document.getElementById('pacientes-tratados-fieles')) document.getElementById('pacientes-tratados-fieles').textContent = fielesTratados;

        // Ticket medio tratados

        const ticketMedioTratados = pacientesTratados !== 0 ? eurosProduccion / pacientesTratados : 0;
        if (document.getElementById('pacientes-tratados-ticket')) document.getElementById('pacientes-tratados-ticket').textContent = ticketMedioTratados.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

        // --- PACIENTES COBRADOS ---
        let primeraCobrados = 0, fielesCobrados = 0;
        cobradosSet.forEach(id => {
            const row = rows.find(r => r['IdPac'] && r['IdPac'].trim() === id);
            if (row) {
                if (row['IdTipoPaciente'] === '1') primeraCobrados++;
                else if (row['IdTipoPaciente'] === '2') fielesCobrados++;
            }
        });
        if (document.getElementById('pacientes-cobrados-primera')) document.getElementById('pacientes-cobrados-primera').textContent = primeraCobrados;
        if (document.getElementById('pacientes-cobrados-fieles')) document.getElementById('pacientes-cobrados-fieles').textContent = fielesCobrados;

        // Ticket medio cobrados
        const ticketMedioCobrados = pacientesCobrados !== 0 ? eurosCobrados / pacientesCobrados : 0;
        if (document.getElementById('pacientes-cobrados-ticket')) document.getElementById('pacientes-cobrados-ticket').textContent = ticketMedioCobrados.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

        // --- Actualiza las tarjetas con updateCard ---
        updateCard({
            cardSelector: '#card-presupuestado',
            value: eurosPresupuestado,
            valueId: 'presupuestado-value',
            anioAnterior: presupuestadoAnioAnterior,
            anioAnteriorId: 'presupuestado-anio-anterior',
            objetivo: presentadosSemanalObjetivo,
            objetivoId: 'presupuestado-objetivo',
            isCurrency: true,
            colorActual: '#01B5B5'
        });
        updateCard({
            cardSelector: '#card-pacientes-comerciales',
            value: pacientesComerciales,
            valueId: 'pacientes-comerciales-value',
            anioAnterior: pacientesComercialesAnioAnterior,
            anioAnteriorId: 'pacientes-comerciales-anio-anterior',
            objetivo: comercialesSemanalObjetivo,
            objetivoId: 'pacientes-comerciales-objetivo',
            colorActual: '#01B5B5'
        });
        updateCard({
            cardSelector: '#card-aceptado',
            value: aceptado,
            valueId: 'aceptado-value',
            anioAnterior: aceptadoAnioAnterior,
            anioAnteriorId: 'aceptado-anio-anterior',
            objetivo: aceptadosSemanalObjetivo,
            objetivoId: 'aceptado-objetivo',
            isCurrency: true,
            colorActual: '#E1C233'
        });
        updateCard({
            cardSelector: '#card-pacientes-aceptados',
            value: pacientesAceptados,
            valueId: 'pacientes-aceptados-value',
            anioAnterior: pacientesAceptadosAnioAnterior,
            anioAnteriorId: 'pacientes-aceptados-anio-anterior',
            objetivo: aceptadosSemanalObjetivo2,
            objetivoId: 'pacientes-aceptados-objetivo',
            colorActual: '#E1C233'
        });
        updateCard({
            cardSelector: '#card-produccion',
            value: produccion,
            valueId: 'produccion-value',
            anioAnterior: produccionAnioAnterior,
            anioAnteriorId: 'produccion-anio-anterior',
            objetivo: produccionSemanalObjetivo,
            objetivoId: 'produccion-objetivo',
            isCurrency: true,
            colorActual: '#EB8D00'
        });
        updateCard({
            cardSelector: '#card-pacientes-tratados',
            value: pacientesTratados,
            valueId: 'pacientes-tratados-value',
            anioAnterior: pacientesTratadosAnioAnterior,
            anioAnteriorId: 'pacientes-tratados-anio-anterior',
            objetivo: tratadosSemanalObjetivo,
            objetivoId: 'pacientes-tratados-objetivo',
            colorActual: '#EB8D00'
        });
        updateCard({
            cardSelector: '#card-caja',
            value: caja,
            valueId: 'caja-value',
            anioAnterior: cajaAnioAnterior,
            anioAnteriorId: 'caja-anio-anterior',
            objetivo: cajaSemanalObjetivo,
            objetivoId: 'caja-objetivo',
            isCurrency: true,
            colorActual: '#6174EE'
        });
        updateCard({
            cardSelector: '#card-pacientes-cobrados',
            value: pacientesCobrados,
            valueId: 'pacientes-cobrados-value',
            anioAnterior: pacientesCobradosAnioAnterior,
            anioAnteriorId: 'pacientes-cobrados-anio-anterior',
            objetivo: cobradoSemanalObjetivo,
            objetivoId: 'pacientes-cobrados-objetivo',
            colorActual: '#6174EE'
        });
    }

    // --- Función para actualizar las barras y textos ---
    function updateCard({ cardSelector, value, valueId, anioAnterior, anioAnteriorId, objetivo, objetivoId, isCurrency = false, colorActual = null }) {
        const maxBar = Math.max(value, objetivo, anioAnterior, 1);
        const widthActual = (value / maxBar) * 100;
        const widthObjetivo = (objetivo / maxBar) * 100;
        const widthAnterior = (anioAnterior / maxBar) * 100;
        const card = document.querySelector(cardSelector);
        if (card) {
            const barActual = card.querySelector('.bar.actual');
            if (barActual) {
                barActual.style.width = widthActual + '%';
                if (colorActual) barActual.style.backgroundColor = colorActual;
            }
            const barObjetivo = card.querySelector('.bar.objetivo');
            if (barObjetivo) barObjetivo.style.width = widthObjetivo + '%';
            const barAnterior = card.querySelector('.bar.anterior');
            if (barAnterior) barAnterior.style.width = widthAnterior + '%';

            const labelActual = card.querySelector('.bar-label.actual-label');
            if (labelActual) labelActual.textContent = isCurrency
                ? Math.round(value).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
                : Math.round(value);
            const labelObjetivo = card.querySelector('.bar-label.objetivo-label');
            if (labelObjetivo) labelObjetivo.textContent = isCurrency
                ? Math.round(objetivo).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
                : Math.round(objetivo);
            const labelAnterior = card.querySelector('.bar-label.anterior-label');
            if (labelAnterior) labelAnterior.textContent = isCurrency
                ? Math.round(anioAnterior).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
                : Math.round(anioAnterior);
        }
        if (document.getElementById(valueId)) document.getElementById(valueId).textContent = isCurrency
            ? Math.round(value).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
            : Math.round(value);
        if (document.getElementById(anioAnteriorId)) document.getElementById(anioAnteriorId).textContent = isCurrency
            ? Math.round(anioAnterior).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
            : Math.round(anioAnterior);
        if (document.getElementById(objetivoId)) document.getElementById(objetivoId).textContent = isCurrency
            ? Math.round(objetivo).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
            : Math.round(objetivo);
    }

    function getYearMonthWeek(fecha) {
        const d = new Date(fecha.split(' ')[0]);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const week = Math.ceil(d.getDate() / 7);
        return { year, month, week };
    }


}