function onSliderMove(key, val) {
    const conf = params_config[key];
    const actualVal = conf.log ? logToVal(val, conf.min, conf.max) : parseFloat(val);
    
    // Special handling for chord and height
    if (key === 'chord' || key === 'height') {
        handleChordHeightSlider(key, actualVal);
        return;
    }
    
    // For radius, diameter, and angle - check limits
    if (key === 'radius' || key === 'diameter' || key === 'angle') {
        handleRadiusAngleSlider(key, actualVal);
        return;
    }
    
    // For other parameters (arc_len)
    setGeometryFromValue(key, actualVal);
    applySnapBack();
    document.getElementById(`input_${key}`).value = Math.round(actualVal);
    updateLimits();
    updateUIElements(key);
}

function handleChordHeightSlider(key, actualVal) {
    const orientCombo = document.getElementById('orient_combo');
    const isHorizontal = orientCombo.selectedIndex === 0;
    const t = isHorizontal ? profiles[selected_profile].w : profiles[selected_profile].h;
    const getBaseR = () => r - (view_mode === "Krawędź wewnętrzna" ? t : (view_mode === "Środek profilu" ? t/2 : 0));
    
    let ra = getBaseR();
    let tempAngle = angle_deg;
    
    if (key === 'chord') {
        let sinHalf = actualVal / (2 * ra);
        if (sinHalf <= 1) {
            tempAngle = 2 * Math.asin(sinHalf) * (180 / Math.PI);
        }
    } else if (key === 'height') {
        let cosHalf = 1 - (actualVal / ra);
        if (cosHalf >= -1 && cosHalf <= 1) {
            tempAngle = 2 * Math.acos(cosHalf) * (180 / Math.PI);
        }
    }
    
    // Check if arc length exceeds limit
    const currentArc = r * (tempAngle * Math.PI / 180);
    if (currentArc > MAX_LEN + 0.1 && !window.isAdvancedMode) {
        showChordHeightLimitToast("Przekroczono limit dłużycy 5750 mm");
        updateUIElements(); // Reset to valid values
        return;
    }
    
    // Apply the change
    angle_deg = tempAngle;
    applySnapBack();
    document.getElementById(`input_${key}`).value = Math.round(actualVal);
    updateUIElements(key);
}

function handleRadiusAngleSlider(key, actualVal) {
    const t = translations[currentLang];
    const orientCombo = document.getElementById('orient_combo');
    const isHorizontal = orientCombo.selectedIndex === 0;
    const profile_t = isHorizontal ? profiles[selected_profile].w : profiles[selected_profile].h;
    
    const getSystemR = (inputR) => {
        if (view_mode === "Krawędź wewnętrzna") return inputR + profile_t;
        if (view_mode === "Środek profilu") return inputR + profile_t / 2;
        return inputR;
    };
    
    if (key === 'angle') {
        const limitR_system = getMaxRadiusForAngle(actualVal);
        
        if (r > limitR_system + 0.1 && !window.isAdvancedMode) {
            // Show confirmation dialog
            const title = t.ask_title || "Stock length limit";
            const safeAngle = Math.floor((MAX_LEN / r) * (180 / Math.PI));
            
            let currentViewR = r;
            let limitR_view = limitR_system;
            if (view_mode === "Krawędź wewnętrzna") {
                currentViewR = r - profile_t;
                limitR_view = limitR_system - profile_t;
            } else if (view_mode === "Środek profilu") {
                currentViewR = r - profile_t / 2;
                limitR_view = limitR_system - profile_t / 2;
            }
            
            const vals = {
                currentR: Math.round(currentViewR),
                newR: Math.round(limitR_view),
                currentA: Math.round(actualVal),
                newA: safeAngle
            };
            
            let msg = t.ask_limit
                .replace(/{angle}/g, Math.round(actualVal))
                .replace(/{newRadius}/g, Math.round(limitR_view))
                .replace(/{radius}/g, Math.round(currentViewR))
                .replace(/{newAngle}/g, safeAngle);
            
            let btnOk = t.btn_confirm.replace(/{angle}/g, Math.round(actualVal)).replace(/{newRadius}/g, Math.round(limitR_view));
            let btnNo = t.btn_cancel.replace(/{radius}/g, Math.round(currentViewR)).replace(/{newAngle}/g, safeAngle);
            
            customConfirm(msg, title, (userAgrees) => {
                if (userAgrees) {
                    r = limitR_system;
                    angle_deg = actualVal;
                } else {
                    angle_deg = safeAngle;
                }
                applySnapBack();
                updateLimits();
                updateUIElements();
            }, btnOk, btnNo, "angle_mode", vals);
            return;
        } else if (window.isAdvancedMode) {
            angle_deg = actualVal;
            applySnapBack();
            updateLimits();
            updateAdvancedModeSegments();
            updateUIElements(key);
            return;
        } else {
            angle_deg = actualVal;
        }
    } 
    else if (key === 'radius' || key === 'diameter') {
        let targetR_input = (key === 'diameter') ? actualVal / 2 : actualVal;
        let requestedSystemR = getSystemR(targetR_input);
        const limitA = (MAX_LEN / requestedSystemR) * (180 / Math.PI);
        
        if (angle_deg > limitA + 0.01 && !window.isAdvancedMode) {
            // Show confirmation dialog
            const title = t.ask_title || "Stock length limit";
            const safeAngle = Math.floor(limitA);
            const limitR_system = getMaxRadiusForAngle(angle_deg);
            
            let limitR_view = limitR_system;
            if (view_mode === "Krawędź wewnętrzna") limitR_view = limitR_system - profile_t;
            else if (view_mode === "Środek profilu") limitR_view = limitR_system - profile_t / 2;
            
            const vals = {
                currentR: Math.round(targetR_input),
                newR: Math.round(limitR_view),
                currentA: Math.round(angle_deg),
                newA: safeAngle
            };
            
            let msg = t.ask_limit_radius
                .replace(/{radius}/g, Math.round(targetR_input))
                .replace(/{newAngle}/g, safeAngle)
                .replace(/{angle}/g, Math.round(angle_deg))
                .replace(/{newRadius}/g, Math.round(limitR_view));
            
            let btnOk = t.btn_cancel.replace(/{radius}/g, Math.round(targetR_input)).replace(/{newAngle}/g, safeAngle);
            let btnNo = t.btn_confirm.replace(/{angle}/g, Math.round(angle_deg)).replace(/{newRadius}/g, Math.round(limitR_view));
            
            customConfirm(msg, title, (userAgrees) => {
                if (userAgrees) {
                    angle_deg = safeAngle;
                    r = requestedSystemR;
                } else {
                    r = limitR_system;
                }
                applySnapBack();
                updateLimits();
                updateUIElements();
            }, btnOk, btnNo, "radius_mode", vals);
            return;
        } else if (window.isAdvancedMode) {
            r = requestedSystemR;
            applySnapBack();
            updateLimits();
            updateAdvancedModeSegments();
            updateUIElements(key);
            return;
        } else {
            r = requestedSystemR;
        }
    }
    
    applySnapBack();
    document.getElementById(`input_${key}`).value = Math.round(actualVal);
    updateLimits();
    updateUIElements(key);
}

function showChordHeightLimitToast(message) {
    let toast = document.getElementById('chord-height-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'chord-height-toast';
        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#d32f2f',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '8px',
            zIndex: '9999',
            fontSize: '14px',
            fontWeight: 'bold'
        });
        document.body.appendChild(toast);
    }
    
    toast.innerText = message;
    toast.style.display = 'block';
    
    // Create progress bar if not exists
    let progressBar = toast.querySelector('div[role="progressbar"]');
    if (!progressBar) {
        progressBar = document.createElement('div');
        progressBar.setAttribute('role', 'progressbar');
        Object.assign(progressBar.style, {
            position: 'absolute',
            bottom: '0',
            left: '0',
            height: '3px',
            backgroundColor: '#ff6b6b',
            width: '100%',
            borderRadius: '0 0 8px 8px',
            transition: 'width 0.1s linear'
        });
        toast.appendChild(progressBar);
    }
    
    const duration = 5000; // 5 seconds
    let remaining = duration;
    
    // Clear any existing timeout
    if (toast.timeoutId) clearTimeout(toast.timeoutId);
    
    const updateBar = setInterval(() => {
        remaining -= 100;
        const percentage = (remaining / duration) * 100;
        progressBar.style.width = percentage + '%';
        
        if (remaining <= 0) {
            clearInterval(updateBar);
            toast.style.display = 'none';
        }
    }, 100);
    
    toast.timeoutId = setTimeout(() => {
        clearInterval(updateBar);
        toast.style.display = 'none';
    }, duration);
}

function updateAdvancedModeSegments() {
    const arcLength = r * (angle_deg * Math.PI / 180);
    const minSegments = calculateMinSegmentsForAdvancedMode(arcLength);
    
    const slider = document.getElementById('segment_slider');
    if (slider) {
        slider.min = minSegments;
        if (parseInt(slider.value) < minSegments) {
            slider.value = minSegments;
        }
        updateAdvancedUI(arcLength, angle_deg);
    }
}

function calculateMinSegmentsForAdvancedMode(arcLength) {
    const stockLengths = [1000, 2020, 3000, 4150, 6150];
    const waste = 400; // waste per segment
    
    // Find minimum number of segments that can fit the arc
    for (let segments = 1; segments <= 20; segments++) {
        // For each segment, check if it fits in any stock length
        const segmentLength = arcLength / segments;
        const requiredLength = segmentLength + waste;
        
        // Check if this required length can fit in any stock
        const canFit = stockLengths.some(stock => stock >= requiredLength);
        if (canFit) {
            return segments;
        }
    }
    
    return 20; // fallback
}