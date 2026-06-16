document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('search-form');
    const earliestStartInput = document.getElementById('earliest_start');
    const latestReturnInput = document.getElementById('latest_return');
    const destContainer = document.getElementById('destinations-container');
    const addDestBtn = document.getElementById('add-dest-btn');
    const resultsContainer = document.getElementById('results');
    const loader = document.getElementById('loader');

    // Autocomplete Logic
    function setupAutocomplete(inputElement, suggestionsElement) {
        let timeout = null;

        inputElement.addEventListener('focus', () => {
            const rowOrGroup = inputElement.closest('.destination-row') || inputElement.closest('.form-group');
            if (rowOrGroup) rowOrGroup.style.zIndex = '50';
        });

        inputElement.addEventListener('blur', () => {
            setTimeout(() => {
                const rowOrGroup = inputElement.closest('.destination-row') || inputElement.closest('.form-group');
                if (rowOrGroup) rowOrGroup.style.zIndex = '';
            }, 200);
        });

        inputElement.addEventListener('input', (e) => {
            clearTimeout(timeout);
            const query = e.target.value.trim();
            
            if (query.length < 2) {
                suggestionsElement.classList.add('hidden');
                return;
            }

            timeout = setTimeout(async () => {
                try {
                    const res = await fetch(`https://autocomplete.travelpayouts.com/places2?term=${query}&locale=de&types[]=city&types[]=airport`);
                    const data = await res.json();
                    
                    if (data.length > 0) {
                        suggestionsElement.innerHTML = '';
                        
                        // Sort so that cities come first, then airports
                        data.sort((a, b) => {
                            if (a.type === 'city' && b.type === 'airport') return -1;
                            if (a.type === 'airport' && b.type === 'city') return 1;
                            return 0;
                        });

                        data.forEach(item => {
                            const div = document.createElement('div');
                            div.className = 'suggestion-item';
                            
                            const isCity = item.type === 'city';
                            const icon = isCity ? '🏙️' : '✈️';
                            const typeLabel = isCity ? 'Stadt' : 'Flughafen';
                            const indent = isCity ? '' : 'padding-left: 2rem;';
                            
                            div.innerHTML = `
                                <div style="display: flex; align-items: center; gap: 0.8rem; ${indent}">
                                    <span>${icon}</span>
                                    <div>
                                        <div style="font-weight: 600; color: #111236;">${item.name}</div>
                                        <div style="font-size: 0.75rem; color: #68697f;">${item.country_name || ''}</div>
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-weight: 700; color: #0770e3;">${item.code}</div>
                                    <div style="font-size: 0.65rem; background: #e1e9f4; padding: 2px 4px; border-radius: 4px; display: inline-block;">${typeLabel}</div>
                                </div>
                            `;
                            
                            div.addEventListener('click', () => {
                                inputElement.value = item.code;
                                suggestionsElement.classList.add('hidden');
                            });
                            suggestionsElement.appendChild(div);
                        });
                        suggestionsElement.classList.remove('hidden');
                    } else {
                        suggestionsElement.classList.add('hidden');
                    }
                } catch (err) {
                    console.error("Autocomplete error", err);
                }
            }, 300);
        });

        document.addEventListener('click', (e) => {
            if (e.target !== inputElement && !suggestionsElement.contains(e.target)) {
                suggestionsElement.classList.add('hidden');
            }
        });
    }

    // Initialize static autocomplete
    setupAutocomplete(document.getElementById('start_airport'), document.getElementById('start-suggestions'));
    setupAutocomplete(document.getElementById('end_airport'), document.getElementById('end-suggestions'));

    // Date validation
    earliestStartInput.addEventListener('change', () => {
        latestReturnInput.min = earliestStartInput.value;
        if (latestReturnInput.value && latestReturnInput.value < earliestStartInput.value) {
            latestReturnInput.value = earliestStartInput.value;
        }
    });

    let destCount = 0;

    function addDestination() {
        destCount++;
        const row = document.createElement('div');
        row.className = 'destination-row';
        row.innerHTML = `
            <h4>Zwischenstopp ${destCount}</h4>
            <button type="button" class="remove-btn">Entfernen</button>
            <div class="form-group" style="position: relative;">
                <label>Nach (Flughafen/Stadt-Code)</label>
                <input type="text" class="dest-airport" placeholder="z.B. Rom" autocomplete="off" required>
                <div class="suggestions-box hidden"></div>
            </div>
            <div style="display:flex; gap:1rem; margin-top:0.8rem;">
                <div class="form-group">
                    <label>Min. Aufenthalt (Tage)</label>
                    <input type="number" class="dest-min" min="1" value="3" required>
                </div>
                <div class="form-group">
                    <label>Max. Aufenthalt (Tage)</label>
                    <input type="number" class="dest-max" min="1" value="6" required>
                </div>
            </div>
        `;

        destContainer.appendChild(row);

        // Setup autocomplete for this new input
        const input = row.querySelector('.dest-airport');
        const box = row.querySelector('.suggestions-box');
        setupAutocomplete(input, box);

        // Setup remove button
        row.querySelector('.remove-btn').addEventListener('click', () => {
            row.remove();
        });
    }

    // Add one default destination
    addDestination();

    addDestBtn.addEventListener('click', addDestination);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const earliest_start = earliestStartInput.value;
        const latest_return = latestReturnInput.value;
        const start_airport = document.getElementById('start_airport').value;
        const end_airport = document.getElementById('end_airport').value || "";

        const destinations = [];
        document.querySelectorAll('.destination-row').forEach(row => {
            destinations.push({
                airport: row.querySelector('.dest-airport').value,
                min_days: parseInt(row.querySelector('.dest-min').value),
                max_days: parseInt(row.querySelector('.dest-max').value)
            });
        });

        const requestData = {
            earliest_start,
            latest_return,
            start_airport,
            end_airport,
            destinations
        };

        resultsContainer.innerHTML = '';
        form.style.display = 'none';
        loader.classList.remove('hidden');

        try {
            const response = await fetch('/api/generate-combos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });
            const data = await response.json();
            
            loader.classList.add('hidden');
            form.style.display = 'block';

            if (data.status === 'success' && data.data.length > 0) {
                resultsContainer.innerHTML = '<h2 style="margin-bottom: 1.5rem; color: var(--primary-color);">Gefundene Reisepläne</h2>';
                
                data.data.forEach((combo) => {
                    const card = document.createElement('div');
                    card.className = 'combo-card';
                    
                    const badge = combo.recommended ? '<span class="recommended-badge">⭐ Empfohlen</span>' : '';
                    
                    let routeHtml = '';
                    combo.route.forEach((leg, i) => {
                        let stayHtml = '';
                        if (leg.stay_duration) {
                            stayHtml = `<div class="stay-info">${leg.stay_duration} Tage Aufenthalt</div>`;
                        }
                        
                        let warningHtml = '';
                        if (leg.is_weekend) {
                            warningHtml = `<span class="weekend-warning">Wochenend-Flug</span>`;
                        }
                        
                        routeHtml += `
                            <div class="route-step">
                                <div class="route-line"></div>
                                <div class="route-icon">✈️</div>
                                <div class="route-info">
                                    <div class="route-airports">${leg.departure_id} ➝ ${leg.arrival_id}</div>
                                    <div class="route-date">${leg.day_name}, ${leg.date} ${warningHtml}</div>
                                    ${stayHtml}
                                </div>
                            </div>
                        `;
                    });

                    card.innerHTML = `
                        <div class="combo-header">
                            <h3>Option ${combo.combo_id.replace('combo_', '') * 1 + 1}</h3>
                            ${badge}
                        </div>
                        <div class="combo-body">
                            ${routeHtml}
                        </div>
                    `;
                    
                    resultsContainer.appendChild(card);
                });
            } else {
                resultsContainer.innerHTML = '<p style="text-align: center;">Keine mathematisch gültigen Kombinationen in diesem Zeitraum gefunden.</p>';
            }
        } catch (error) {
            console.error(error);
            loader.classList.add('hidden');
            form.style.display = 'block';
            resultsContainer.innerHTML = '<p style="text-align: center; color: var(--danger);">Fehler bei der Berechnung.</p>';
        }
    });

});
