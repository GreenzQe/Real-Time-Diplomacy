const svgNS = "http://www.w3.org/2000/svg";
let svg;
let tileStats = {};
let units = [];  // Array to store units
let panZoomInstance;
let currentZoom = 1;  // Track current zoom level

// Load JSON and Initialize the Map
function loadMapData(url) {
    fetch(url)
        .then(response => response.json())
        .then(mapData => {
            createSVG(mapData);
            initTileStats(mapData);
            addUnitToRegion("Jutland_01", "Player1");
        })
        .catch(error => console.error("Error loading JSON:", error));
}

// Create an SVG element and append regions
function createSVG(mapData) {
    svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100vw");
    svg.setAttribute("height", "100vh");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    mapData.regions.forEach(region => {
        const path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", region.path);
        path.setAttribute("fill", "gray");
        path.setAttribute("stroke", "black");
        path.setAttribute("stroke-width", "0.1");
        path.setAttribute("id", region.id);
        svg.appendChild(path);
    });

    document.body.appendChild(svg);

     // Tooltip element
     const tooltip = document.createElement("div");
     tooltip.style.position = "absolute";
     tooltip.style.padding = "10px";
     tooltip.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
     tooltip.style.color = "white";
     tooltip.style.borderRadius = "5px";
     tooltip.style.visibility = "hidden"; // Initially hidden
     tooltip.style.pointerEvents = "none"; // Make sure it doesn't interfere with other interactions
     document.body.appendChild(tooltip);
 
     // Function to show tooltip with information
     function showTooltip(event, regionId) {
         const region = tileStats[regionId];
         tooltip.textContent = `Region ID: ${regionId}\nTile stats: ${JSON.stringify(region, null, 2)}`;
         tooltip.style.visibility = "visible";
 
         // Position tooltip near the mouse cursor
         tooltip.style.left = `${event.pageX + 10}px`;  // Add some offset for visibility
         tooltip.style.top = `${event.pageY + 10}px`;
     }
 
         // Function to hide the tooltip
    function hideTooltip() {
        tooltip.style.visibility = "hidden";
    }

    // Add event listeners to regions (hover effect)
    const countries = svg.querySelectorAll("path");
    countries.forEach(country => {
        const regionId = country.id;
        const originalColor = country.getAttribute("fill");

        // Show tooltip on hover
        country.addEventListener("mouseover", (event) => {
            showTooltip(event, regionId);
            
            // Create radial gradient
            const gradientId = `gradient-${country.id}`;
            const defs = svg.querySelector("defs") || document.createElementNS(svgNS, "defs");
            const radialGradient = document.createElementNS(svgNS, "radialGradient");
            radialGradient.setAttribute("id", gradientId);
            radialGradient.setAttribute("cx", "50%");
            radialGradient.setAttribute("cy", "50%");
            radialGradient.setAttribute("r", "90%");
            radialGradient.setAttribute("fx", "50%");
            radialGradient.setAttribute("fy", "50%");

            const stop1 = document.createElementNS(svgNS, "stop");
            stop1.setAttribute("offset", "0%");
            stop1.setAttribute("stop-color", originalColor); // Current region color
            radialGradient.appendChild(stop1);

            const stop2 = document.createElementNS(svgNS, "stop");
            stop2.setAttribute("offset", "100%");
            stop2.setAttribute("stop-color", "lightblue");
            radialGradient.appendChild(stop2);

            defs.appendChild(radialGradient);
            svg.appendChild(defs);

            // Apply the gradient to the region
            country.setAttribute("fill", `url(#${gradientId})`);
        });

        // Hide tooltip and revert color when hover ends
        country.addEventListener("mouseleave", () => {
            hideTooltip();
            country.setAttribute("fill", originalColor); // Restore the original color
        });
    });
 

    // Initialize zoom with fixed limits
    const panZoom = svgPanZoom(svg, {
        zoomEnabled: true,
        fit: true,
        center: true,
        minZoom: 1,  // Ensures a fixed minimum zoom
        maxZoom: 20,  // Prevents excessive zooming out or in
        zoomScaleSensitivity: 0.2 // Adjusts how fast zooming happens
    });

    // Wait for the zoom to be initialized and force max zoom level
    window.addEventListener("load", () => {
        panZoom.zoom(panZoom.getMaxZoom());  // Zoom to max on page load
    });
}

// Unit object structure
function createUnit(regionId, position, health, owner) {
    return {
        id: `${regionId}-unit`,  // Unique ID for unit
        regionId: regionId,
        position: position,  // {x, y} coordinates
        health: health,
        owner: owner,  // Owner (e.g., player or team ID)
        element: null  // SVG element representing the unit
    };
}

// Function to render the unit as an SVG element
function renderUnit(unit) {
    // Choose a color based on the owner
    const ownerColor = unit.owner === "Player1" ? "red" : unit.owner === "Player2" ? "blue" : "gray"; // Example owner colors

    // Create a simple circle to represent the unit
    const unitElement = document.createElementNS(svgNS, "circle");
    unitElement.setAttribute("cx", unit.position.x);
    unitElement.setAttribute("cy", unit.position.y);
    unitElement.setAttribute("r", 10);  // Radius of the unit
    unitElement.setAttribute("fill", ownerColor);  // Fill color based on owner
    unitElement.setAttribute("stroke", "black");
    unitElement.setAttribute("stroke-width", "1");

    // Add the unit to the SVG
    svg.appendChild(unitElement);
    
    // Save the reference to the unit element
    unit.element = unitElement;
}


// Function to add a unit to a specific region
function addUnitToRegion(regionId, owner) {
    const region = svg.querySelector(`#${regionId}`);
    if (region) {
        // Get the center coordinates of the region (just an example, you can adjust based on the actual region shape)
        const boundingBox = region.getBoundingClientRect();
        const centerX = boundingBox.left + boundingBox.width / 2;
        const centerY = boundingBox.top + boundingBox.height / 2;
        
        // Create a unit at the center of the region with the specified owner
        const unit = createUnit(regionId, { x: centerX, y: centerY }, 100, owner);  // 100 health for now
        renderUnit(unit);
        units.push(unit);  // Add to the units array for future reference
    }
}

// Update zoom level
function updateZoomLevel(zoom) {
    currentZoom = zoom;  // Update the current zoom level
    updateUnitPositions();  // Reposition units based on the new zoom level
}

// Function to update unit positions based on the zoom level and pan position
function updateUnitPositions() {
    units.forEach(unit => {
        if (unit.element) {
            const region = svg.querySelector(`#${unit.regionId}`);
            if (region) {
                // Get the center of the region again, accounting for zoom and pan
                const boundingBox = region.getBoundingClientRect();
                const centerX = boundingBox.left + boundingBox.width / 2;
                const centerY = boundingBox.top + boundingBox.height / 2;

                // Adjust unit's position based on the zoom level and pan offset
                const pan = panZoomInstance.getPan();  // Get the current pan offset
                const scale = panZoomInstance.getScale();  // Get the current zoom scale

                // Apply pan and zoom transformations to the unit's position
                const adjustedX = (centerX + pan.x) * scale;
                const adjustedY = (centerY + pan.y) * scale;

                unit.element.setAttribute("cx", adjustedX);
                unit.element.setAttribute("cy", adjustedY);
            }
        }
    });
}

// Initialize tile stats from JSON
function initTileStats(mapData) {
    mapData.regions.forEach(region => {
        tileStats[region.id] = {
            owner: null,
            tax_tile: false,
            terrain: region.terrain || "plain"
        };
    });
}


// Start the game on load
document.addEventListener("DOMContentLoaded", () => {
    loadMapData("assets/map.json");
});
