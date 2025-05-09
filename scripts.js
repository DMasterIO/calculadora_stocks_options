/* 
      Tabla de 8 tramos para el Impuesto Global Complementario 2025:
      
      Renta imponible anual                      | Factor  | Cantidad a rebajar
      -------------------------------------------------------------
      $0 – $10.901.628                            | 0.000   | $0,00
      $10.901.628 – $24.225.840                    | 0.040   | $436.065,12
      $24.225.840 – $40.376.400                    | 0.080   | $1.405.098,72
      $40.376.400 – $56.526.960                    | 0.135   | $3.625.800,72
      $56.526.960 – $72.677.520                    | 0.230   | $8.995.861,92
      $72.677.520 – $96.903.360                    | 0.304   | $14.373.998,40
      $96.903.360 – $250.333.680                   | 0.350   | $18.831.552,96
      $250.333.680 – En adelante                  | 0.400   | $31.348.236,96
    */
      const taxBrackets = [
        { lower: 0,           upper: 10901628,    factor: 0.000, deduction: 0 },
        { lower: 10901628,    upper: 24225840,    factor: 0.040, deduction: 436065.12 },
        { lower: 24225840,    upper: 40376400,    factor: 0.080, deduction: 1405098.72 },
        { lower: 40376400,    upper: 56526960,    factor: 0.135, deduction: 3625800.72 },
        { lower: 56526960,    upper: 72677520,    factor: 0.230, deduction: 8995861.92 },
        { lower: 72677520,    upper: 96903360,    factor: 0.304, deduction: 14373998.40 },
        { lower: 96903360,    upper: 250333680,   factor: 0.350, deduction: 18831552.96 },
        { lower: 250333680,   upper: Infinity,    factor: 0.400, deduction: 31348236.96 }
      ];
      
      /**
       * Calcula el impuesto total para un ingreso dado usando la fórmula:
       *    Impuesto = (Ingreso × factor) − deducción.
       * @param {number} income - Ingreso anual (CLP)
       * @returns {number} Impuesto total (CLP)
       */
      function calculateTotalTax(income) {
        for (let bracket of taxBrackets) {
          if (income >= bracket.lower && income < bracket.upper) {
            return income * bracket.factor - bracket.deduction;
          }
        }
        let lastBracket = taxBrackets[taxBrackets.length - 1];
        return income * lastBracket.factor - lastBracket.deduction;
      }
      
      /**
       * Calcula el impuesto incremental al sumar un extra al ingreso base:
       *    Impuesto Incremental = T(Ingreso Base + Extra) – T(Ingreso Base)
       * @param {number} baseIncome - Ingreso anual base (CLP)
       * @param {number} extraIncome - Monto extra (CLP)
       * @returns {number} Impuesto incremental (CLP)
       */
      function calculateIncrementalTax(baseIncome, extraIncome) {
        return calculateTotalTax(baseIncome + extraIncome) - calculateTotalTax(baseIncome);
      }
      
      /**
       * Devuelve el objeto de tramo en el que se encuentra un ingreso dado.
       * @param {number} income - Ingreso anual (CLP)
       * @returns {object} Tramo correspondiente.
       */
      function getBracketForIncome(income) {
        return taxBrackets.find(bracket => income >= bracket.lower && income < bracket.upper) ||
               taxBrackets[taxBrackets.length - 1];
      }
      
      /**
       * Devuelve el número de tramo (1 a 8) en el que se encuentra el ingreso.
       * @param {number} income - Ingreso anual (CLP)
       * @returns {number} Número de tramo.
       */
      function getBracketNumber(income) {
        const index = taxBrackets.findIndex(bracket => income >= bracket.lower && income < bracket.upper);
        return index === -1 ? taxBrackets.length : index + 1;
      }
      
      // Función para obtener dinámicamente el valor del dólar (USD a CLP) usando mindicador.cl
      function fetchExchangeRate() {
        fetch('https://mindicador.cl/api/dolar')
          .then(response => response.json())
          .then(data => {
            if (data && data.serie && data.serie.length > 0) {
              // Se extrae el valor del primer elemento de "serie" (el más reciente)
              const exchangeRate = data.serie[0].valor;
              document.getElementById('exchangeRate').value = exchangeRate.toFixed(2);
              document.getElementById('exchangeRateIndicator').textContent = 
                    `Valor USD/CLP obtenido desde mindicador.cl: ${exchangeRate.toFixed(2)} CLP`;
            } else {
              document.getElementById('exchangeRateIndicator').textContent = 
                'No se pudo obtener el valor del dólar.';
            }
          })
          .catch(error => {
            console.error('Error al obtener el valor del dólar:', error);
            document.getElementById('exchangeRateIndicator').textContent = 
              'Error al obtener el valor del dólar.';
          });
      }
      
      document.addEventListener('DOMContentLoaded', fetchExchangeRate);
      
      /**
       * Calcula y retorna la curva del rendimiento efectivo.
       * Para cada valor extra desde un valor mínimo (evitando división por 0) hasta el máximo,
       * se calcula: Rendimiento = [(x – (T(ing + x) – T(ing)))/x] * 100.
       * @param {number} annualGross - Ingreso base anual (CLP)
       * @param {number} maxExtra - Monto extra máximo (CLP)
       * @returns {object} Con arrays: { x: [...], tax: [...], net: [...], gross: [...] }
       */
      function computeYieldCurve(annualGross, maxExtra) {
        let xValues = [], taxValues = [], netValues = [], grossValues = [];
        
        // Calculate values in 10% increments of maxExtra
        for (let i = 0; i <= 10; i++) {
          let x = (maxExtra * i) / 10; // 0%, 10%, 20%, ..., 100%
          let taxIncrement = calculateIncrementalTax(annualGross, x);
          let netExtra = x - taxIncrement;
          
          xValues.push(x);
          taxValues.push(taxIncrement);
          netValues.push(netExtra);
          grossValues.push(x);
        }
        
        return {
          x: xValues,
          tax: taxValues,
          net: netValues,
          gross: grossValues
        };
      }
      
      let yieldChartInstance = null;
      
      document.getElementById('calcForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Se recogen los valores del formulario
        const monthlyGross = parseFloat(document.getElementById('monthlyGross').value);
        const stockUSD = parseFloat(document.getElementById('stockUSD').value);
        const exchangeRate = parseFloat(document.getElementById('exchangeRate').value);
        
        // Ingreso anual base y conversión de stock options a CLP
        const annualGross = monthlyGross * 12;
        const stockTotalCLP = stockUSD * exchangeRate;
        
        // Escenario 1: Ejercicio completo (100%) de las stock options
        const taxIncrementFull = calculateIncrementalTax(annualGross, stockTotalCLP);
        const netExtraFull = stockTotalCLP - taxIncrementFull;
        
        // Escenario 2: Ejercicio "óptimo" (máximo extra sin salir del tramo actual)
        let currentBracket = getBracketForIncome(annualGross);
        const extraMaxInBracket = currentBracket.upper - annualGross;
        const optimalExtra = Math.min(stockTotalCLP, extraMaxInBracket);
        const taxIncrementOptimal = calculateIncrementalTax(annualGross, optimalExtra);
        const netExtraOptimal = optimalExtra - taxIncrementOptimal;
        
        // Cálculo de rendimientos efectivos
        const yieldFull = stockTotalCLP > 0 ? ((netExtraFull / stockTotalCLP) * 100) : 0;
        const yieldOptimal = optimalExtra > 0 ? ((netExtraOptimal / optimalExtra) * 100) : 0;
        
        const netExtraFullUSD = netExtraFull / exchangeRate;
        const netExtraOptimalUSD = netExtraOptimal / exchangeRate;
        
        // Ingresos totales según cada escenario
        const fullIncome = annualGross + stockTotalCLP;
        const optimalIncome = annualGross + optimalExtra;
        
        // Información de tramos con número de tramo
        const baseBracket = getBracketForIncome(annualGross);
        const baseBracketNumber = getBracketNumber(annualGross);
        
        const fullBracket = getBracketForIncome(fullIncome);
        const fullBracketNumber = getBracketNumber(fullIncome);
        
        const optimalBracket = getBracketForIncome(optimalIncome);
        const optimalBracketNumber = getBracketNumber(optimalIncome);
        
        // Construcción de la salida de resultados con fórmulas y numeración de tramos
        const resultDiv = document.getElementById("result");
        resultDiv.innerHTML = `
          <h2>Resultados</h2>
          
          <h3>Ejercicio del 100% de las Stock Options</h3>
          <p><strong>Monto Bruto de Stock Options:</strong> ${stockTotalCLP.toLocaleString('es-CL')} CLP (${stockUSD.toLocaleString('es-CL')} USD)</p>
          <p><strong>Impuesto Incremental Calculado:</strong> ${taxIncrementFull.toLocaleString('es-CL')} CLP</p>
          <p><strong>Beneficio Neto Adicional:</strong> ${netExtraFull.toLocaleString('es-CL')} CLP (${netExtraFullUSD.toFixed(2)} USD)</p>
          <p><strong>Rendimiento Efectivo:</strong> ${yieldFull.toFixed(2)}%</p>
          
          <hr>
          
          <h3>Ejercicio Óptimo (Mayor Rendimiento Porcentual)</h3>
          <p><strong>Monto de Stock Options Utilizado:</strong> ${optimalExtra.toLocaleString('es-CL')} CLP (≈ ${(optimalExtra / exchangeRate).toFixed(2)} USD)</p>
          <p><strong>Impuesto Incremental Calculado:</strong> ${taxIncrementOptimal.toLocaleString('es-CL')} CLP</p>
          <p><strong>Beneficio Neto Adicional:</strong> ${netExtraOptimal.toLocaleString('es-CL')} CLP (≈ ${netExtraOptimalUSD.toFixed(2)} USD)</p>
          <p><strong>Rendimiento Efectivo:</strong> ${yieldOptimal.toFixed(2)}%</p>
          
          <hr>
          
          <h3>Información de Tramo</h3>
          <p>
            <strong>Ingreso Anual Base:</strong> ${annualGross.toLocaleString('es-CL')} CLP<br>
            &bull; Tramo #${baseBracketNumber}: de ${baseBracket.lower.toLocaleString('es-CL')} a ${baseBracket.upper === Infinity ? '∞' : baseBracket.upper.toLocaleString('es-CL')} CLP<br>
            &bull; Factor: ${baseBracket.factor} / Ded. ${baseBracket.deduction.toLocaleString('es-CL')} CLP
          </p>
          <p>
            <strong>Ingreso Total con Ejercicio Total:</strong> ${fullIncome.toLocaleString('es-CL')} CLP<br>
            &bull; Tramo #${fullBracketNumber}: de ${fullBracket.lower.toLocaleString('es-CL')} a ${fullBracket.upper === Infinity ? '∞' : fullBracket.upper.toLocaleString('es-CL')} CLP<br>
            &bull; Factor: ${fullBracket.factor} / Ded. ${fullBracket.deduction.toLocaleString('es-CL')} CLP
          </p>
          <p>
            <strong>Ingreso Total con Ejercicio Óptimo:</strong> ${optimalIncome.toLocaleString('es-CL')} CLP<br>
            &bull; Tramo #${optimalBracketNumber}: de ${optimalBracket.lower.toLocaleString('es-CL')} a ${optimalBracket.upper === Infinity ? '∞' : optimalBracket.upper.toLocaleString('es-CL')} CLP<br>
            &bull; Factor: ${optimalBracket.factor} / Ded. ${optimalBracket.deduction.toLocaleString('es-CL')} CLP
          </p>
        `;
        
        // Configuración de la gráfica: se muestra la curva de rendimiento efectivo
        // Se usa el monto total de las stock options (ejercicio del 100%)
        const yieldCurve = computeYieldCurve(annualGross, stockTotalCLP);
        
        // Destroy existing chart if it exists
        if (yieldChartInstance) {
          yieldChartInstance.destroy();
        }
        
        const ctx = document.getElementById('yieldChart').getContext('2d');
        yieldChartInstance = new Chart(ctx, {
          type: 'line',
          data: {
            labels: yieldCurve.x.map(x => `${(x / stockTotalCLP * 100).toFixed(0)}%`),
            datasets: [
              {
                label: 'Valor Bruto (CLP)',
                data: yieldCurve.gross,
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                fill: true,
                tension: 0.1,
                pointRadius: 3
              },
              {
                label: 'Impuesto Incremental (CLP)',
                data: yieldCurve.tax,
                borderColor: 'rgba(255, 99, 132, 1)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                fill: true,
                tension: 0.1,
                pointRadius: 3
              },
              {
                label: 'Neto Adicional (CLP)',
                data: yieldCurve.net,
                borderColor: 'rgba(54, 162, 235, 1)',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                fill: true,
                tension: 0.1,
                pointRadius: 3
              }
            ]
          },
          options: {
            responsive: true,
            interaction: {
              mode: 'index',
              intersect: false
            },
            scales: {
              x: {
                title: {
                  display: true,
                  text: 'Porcentaje del Valor Bruto de las Opciones'
                }
              },
              y: {
                title: {
                  display: true,
                  text: 'Monto (CLP)'
                },
                ticks: {
                  callback: function(value) {
                    return value.toLocaleString('es-CL');
                  }
                }
              }
            },
            plugins: {
              legend: {
                position: 'top',
                labels: {
                  boxWidth: 20
                }
              },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    const label = context.dataset.label || '';
                    const value = context.parsed.y.toLocaleString('es-CL');
                    return `${label}: ${value} CLP`;
                  }
                }
              }
            }
          }
        });
      });