const svgNS = "http://www.w3.org/2000/svg";
const BASE_SPEED = 1;
const WATER_MULTIPLIER = 0.5;
const ENEMY_TERRITORY_MULTIPLIER = 1 / 3;

let svg;
let tileStats = {};
let units = [];
let panZoomInstance;
let currentZoom = 1;
let destination = null;
let selectedUnit = null;

document.addEventListener("DOMContentLoaded", () => {
  loadMapData("assets/map.json");
  setInterval(updateTime, 1000);
});


function handleMoveUnitBtnClick() {
    if (destination && selectedUnit) {
      moveUnitToDestination(selectedUnit, destination);
      destination = null;
    } else {
      alert("Please select a unit and a destination on the map first.");
    }
  }

  function handleMapContainerClick(event) {
    if (!selectedUnit) {
      console.log("Please select a unit first.");
      return;
    }
    
    if (selectedUnit.isTraveling) {
      console.log("Unit is moving. Cannot set a new destination.");
      return;
    }
    
    const viewport = svg.querySelector("#viewport");
    const point = svg.createSVGPoint();
    const rect = svg.getBoundingClientRect();
    
    point.x = event.clientX - rect.left;
    point.y = event.clientY - rect.top;
    
    // Get the transformation matrix applied by svg-pan-zoom
    const screenCTM = viewport.getScreenCTM().inverse();
    const svgPoint = point.matrixTransform(screenCTM);
    
    // Set the destination
    destination = { x: svgPoint.x, y: svgPoint.y };
    console.log("Destination selected:", destination);
    
    // Remove previous destination marker and text, if any.
    if (window.destinationMarker) {
      window.destinationMarker.remove();
      window.destinationText.remove();
    }
    
    // Create a small yellow dot at the destination.
    window.destinationMarker = document.createElementNS(svgNS, "circle");
    window.destinationMarker.setAttribute("cx", destination.x);
    window.destinationMarker.setAttribute("cy", destination.y);
    window.destinationMarker.setAttribute("r", 0.5);
    window.destinationMarker.setAttribute("fill", "yellow");
    svg.querySelector("#unitsGroup").appendChild(window.destinationMarker);
    
    // Calculate estimated travel time from the selected unit to the destination.
    const travelTime = calculateEstimatedTravelTime(selectedUnit.position, destination);
    
    // Create a text element displaying the travel time next to the destination marker.
    window.destinationText = document.createElementNS(svgNS, "text");
    window.destinationText.setAttribute("x", destination.x + 1); // offset a bit to the right
    window.destinationText.setAttribute("y", destination.y - 1); // offset a bit upward
    window.destinationText.setAttribute("fill", "black");
    window.destinationText.setAttribute("font-size", "2");
    window.destinationText.textContent = `${travelTime.toFixed(1)}s`;
    svg.querySelector("#unitsGroup").appendChild(window.destinationText);
  }
  
  function loadMapData(url) {
    fetch(url)
      .then(response => response.json())
      .then(mapData => {
        createSVG(mapData);
        tileStats(mapData);
        addUnitToRegion("Jutland_01", "Player1");
        updatePlayerStats();
      })
      .catch(error => console.error("Error loading JSON:", error));
  }
  
  function setupEventListeners() {
    document.getElementById("createUnitBtn").addEventListener("click", () => addUnitToRegion("Jutland_01", "Player1"));
    document.getElementById("tradeBtn").addEventListener("click", () => alert("Trade action triggered!"));
    document.getElementById("moveUnitBtn").addEventListener("click", handleMoveUnitBtnClick);
    document.getElementById("mapContainer").addEventListener("click", handleMapContainerClick);
    document.getElementById("closeUnitInfoBtn").addEventListener("click", deselectUnit);
  }
  
  

  function createSVG(mapData) {
    svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  
    // Create a defs element if you use gradients or other definitions
    const defs = document.createElementNS(svgNS, "defs");
    svg.appendChild(defs);
  
    // Create the viewport group
    const viewportGroup = document.createElementNS(svgNS, "g");
    viewportGroup.setAttribute("id", "viewport");
    svg.appendChild(viewportGroup);
  
    // Create regions group inside viewport
    const regionsGroup = document.createElementNS(svgNS, "g");
    regionsGroup.setAttribute("id", "regionsGroup");
    viewportGroup.appendChild(regionsGroup);
  
    // Create units group inside viewport
    const unitsGroup = document.createElementNS(svgNS, "g");
    unitsGroup.setAttribute("id", "unitsGroup");
    viewportGroup.appendChild(unitsGroup);
  
    // Now create your map regions
    mapData.regions.forEach(region => {
      const path = document.createElementNS(svgNS, "path");
      path.setAttribute("d", region.path);
      path.setAttribute("fill", "gray");
      path.setAttribute("stroke", "black");
      path.setAttribute("stroke-width", "0.1");
      path.setAttribute("id", region.id);
      regionsGroup.appendChild(path);
    });
  
    document.getElementById("mapContainer").appendChild(svg);
    setupTooltip();
    setupZoom(); // Ensure this is called here
    setupEventListeners(); // Ensure this is called here
  }
  

function setupTooltip() {
  const tooltip = document.createElement("div");
  tooltip.style.position = "absolute";
  tooltip.style.padding = "10px";
  tooltip.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
  tooltip.style.color = "white";
  tooltip.style.borderRadius = "5px";
  tooltip.style.visibility = "hidden";
  tooltip.style.pointerEvents = "none";
  document.body.appendChild(tooltip);

  svg.querySelectorAll("path").forEach(country => {
    const regionId = country.id;
    const originalColor = country.getAttribute("fill");

    country.addEventListener("mouseover", event => showTooltip(event, regionId, tooltip, originalColor));
    country.addEventListener("mouseleave", () => hideTooltip(tooltip, country, originalColor));
  });
}

function showTooltip(event, regionId, tooltip, originalColor) {
  const region = tileStats[regionId];
  tooltip.textContent = `Region ID: ${regionId}\nTile stats: ${JSON.stringify(region, null, 2)}`;
  tooltip.style.visibility = "visible";
  tooltip.style.left = `${event.pageX + 10}px`;
  tooltip.style.top = `${event.pageY + 10}px`;

  const gradientId = `gradient-${regionId}`;
  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS(svgNS, "defs");
    svg.insertBefore(defs, svg.firstChild);
  }
  const radialGradient = createRadialGradient(gradientId, originalColor);
  defs.appendChild(radialGradient);
  event.target.setAttribute("fill", `url(#${gradientId})`);
}

function hideTooltip(tooltip, country, originalColor) {
  tooltip.style.visibility = "hidden";
  country.setAttribute("fill", originalColor);
}

function createRadialGradient(id, color) {
  const radialGradient = document.createElementNS(svgNS, "radialGradient");
  radialGradient.setAttribute("id", id);
  radialGradient.setAttribute("cx", "50%");
  radialGradient.setAttribute("cy", "50%");
  radialGradient.setAttribute("r", "90%");
  radialGradient.setAttribute("fx", "50%");
  radialGradient.setAttribute("fy", "50%");

  const stop1 = document.createElementNS(svgNS, "stop");
  stop1.setAttribute("offset", "0%");
  stop1.setAttribute("stop-color", color);
  radialGradient.appendChild(stop1);

  const stop2 = document.createElementNS(svgNS, "stop");
  stop2.setAttribute("offset", "100%");
  stop2.setAttribute("stop-color", "lightblue");
  radialGradient.appendChild(stop2);

  return radialGradient;
}

function setupZoom() {
    panZoomInstance = svgPanZoom(svg, {
      viewportSelector: '#viewport',
      panEnabled: true,
      controlIconsEnabled: true,
      zoomEnabled: true,
      dblClickZoomEnabled: true,
      mouseWheelZoomEnabled: true,
      preventMouseEventsDefault: false, // Allow events to propagate
      zoomScaleSensitivity: 0.2,
      minZoom: 0.5,
      maxZoom: 10,
      fit: true,
      center: true,
    });
  }
  
  

function createUnit(regionId, position, health, owner) {
  return {
    id: `${regionId}-unit`,
    regionId: regionId,
    position: position,
    health: health,
    owner: owner,
    element: null,
    isTraveling: false,
    travelTime: 0,
  };
}

function renderUnit(unit) {
    const ownerColor = unit.owner === "Player1" ? "red" : unit.owner === "Player2" ? "blue" : "gray";
    const unitElement = document.createElementNS(svgNS, "circle");
    unitElement.setAttribute("cx", unit.position.x);
    unitElement.setAttribute("cy", unit.position.y);
    unitElement.setAttribute("r", 1);
    unitElement.setAttribute("fill", ownerColor);
    unitElement.setAttribute("stroke", "black");
    unitElement.setAttribute("stroke-width", "0.1");
  
    const unitsGroup = svg.querySelector("#unitsGroup");
    unitsGroup.appendChild(unitElement);
  
    unit.element = unitElement;
    unitElement.addEventListener("click", () => selectUnit(unit));
  }
  

function addUnitToRegion(regionId, owner) {
  const region = svg.querySelector(`#${regionId}`);
  if (region) {
    const bbox = region.getBBox();
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;
    const unit = createUnit(regionId, { x: centerX, y: centerY }, 100, owner);
    renderUnit(unit);
    units.push(unit);
    updatePlayerStats();
  }
}

function selectUnit(unit) {
    const unitInfoPanel = document.getElementById("unitInfoPanel");
    unitInfoPanel.style.display = "block";
    document.getElementById("unitHealth").textContent = `Health: ${unit.health}`;
    document.getElementById("unitTravelTime").textContent = unit.isTraveling ? `Travel Time: ${unit.travelTime}s` : "Travel Time: -";
  
    // Determine region or water
    const regionId = findRegionAtPoint(unit.position.x, unit.position.y);
    const locationLabel = regionId ? regionId : "Water";
    document.getElementById("unitLocation").textContent = `Location: ${locationLabel}`;
  
    document.getElementById("moveUnitBtn").style.display = "inline-block";
    document.getElementById("closeUnitInfoBtn").style.display = "inline-block";
    selectedUnit = unit;
  }

  function deselectUnit() {
    selectedUnit = null;
    const unitInfoPanel = document.getElementById("unitInfoPanel");
    unitInfoPanel.style.display = "none";
    // Optionally clear the fields:
    document.getElementById("unitHealth").textContent = "";
    document.getElementById("unitTravelTime").textContent = "Travel Time: -";
    document.getElementById("unitLocation").textContent = "";
    document.getElementById("moveUnitBtn").style.display = "none";
    document.getElementById("closeUnitInfoBtn").style.display = "none";
    console.log("Unit deselected.");
  }

  function moveUnitToDestination(unit, dest) {
    if (unit.isTraveling) {
      console.log(`Unit ${unit.id} is already moving!`);
      return;
    }
    
    // Remove destination marker and text as soon as movement starts.
    if (window.destinationMarker) {
      window.destinationMarker.remove();
      window.destinationText.remove();
    }
    
    const { x: startX, y: startY } = unit.position;
    const { x: endX, y: endY } = dest;
    const dx = endX - startX;
    const dy = endY - startY;
    const totalDistance = Math.sqrt(dx * dx + dy * dy);
    
    // Calculate the estimated travel time once (using sampling)
    const estimatedTravelTime = calculateEstimatedTravelTime(unit.position, dest);
    console.log(`Estimated travel time for ${unit.id}: ${estimatedTravelTime.toFixed(1)}s`);
    
    // Optionally draw a temporary line (using the same code as before)
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", startX);
    line.setAttribute("y1", startY);
    line.setAttribute("x2", endX);
    line.setAttribute("y2", endY);
    line.setAttribute("stroke", "yellow");
    line.setAttribute("stroke-width", "0.1");
    svg.querySelector("#unitsGroup").appendChild(line);
    
    let distanceTraveled = 0;
    let lastFrameTime = 0;
    unit.isTraveling = true;
    unit.travelTime = estimatedTravelTime; // initial value
    
    const directionX = dx / totalDistance;
    const directionY = dy / totalDistance;
    
    function animate(timestamp) {
      if (!lastFrameTime) lastFrameTime = timestamp;
      const dt = (timestamp - lastFrameTime) / 1000;
      lastFrameTime = timestamp;
    
      // Check environment (adjust speed if necessary)
      let localSpeed = BASE_SPEED;
      if (isWater(unit.position)) {
        localSpeed *= WATER_MULTIPLIER;
      } else if (isEnemyTerritory(unit.position)) {
        localSpeed *= ENEMY_TERRITORY_MULTIPLIER;
      }
    
      const distanceStep = localSpeed * dt;
      distanceTraveled += distanceStep;
      if (distanceTraveled > totalDistance) {
        distanceTraveled = totalDistance;
      }
    
      const currentX = startX + directionX * distanceTraveled;
      const currentY = startY + directionY * distanceTraveled;
      unit.position = { x: currentX, y: currentY };
      if (unit.element) {
        unit.element.setAttribute("cx", currentX);
        unit.element.setAttribute("cy", currentY);
      }
    
      // Calculate and log remaining travel time
      const distanceLeft = totalDistance - distanceTraveled;
      const remainingTime = distanceLeft / localSpeed;
      unit.travelTime = remainingTime;
    
      if (distanceTraveled < totalDistance) {
        requestAnimationFrame(animate);
      } else {
        unit.isTraveling = false;
        unit.travelTime = 0;
        line.remove();
        console.log(`Unit ${unit.id} reached destination`);
      }
    }
    
    requestAnimationFrame(animate);
  }

  function isWater(point) {
    const regionId = findRegionAtPoint(point.x, point.y);
    if (!regionId) {
      // If there's no region, treat it as water
      return true;
    }
    const regionData = tileStats[regionId] || {};
    return regionData.terrain === "water";
  }

function isEnemyTerritory(point) {
  return false;
}

function calculateEstimatedTravelTime(start, dest, segments = 10) {
    const dx = dest.x - start.x;
    const dy = dest.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    let multiplierSum = 0;
  
    // Sample along the path, including both endpoints.
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const samplePoint = {
        x: start.x + dx * t,
        y: start.y + dy * t
      };
  
      let multiplier = 1; // Normal land multiplier
      if (isWater(samplePoint)) {
        multiplier = WATER_MULTIPLIER;
      } else if (isEnemyTerritory(samplePoint)) {
        multiplier = ENEMY_TERRITORY_MULTIPLIER;
      }
      multiplierSum += multiplier;
    }
  
    const averageMultiplier = multiplierSum / (segments + 1);
    return distance / (BASE_SPEED * averageMultiplier);
  }

function findRegionAtPoint(x, y) {
    // Searches all regions to see if the point is inside their path
    const regionPaths = svg.querySelectorAll("#regionsGroup path");
    const pointObj = svg.createSVGPoint();
    pointObj.x = x;
    pointObj.y = y;
    for (const path of regionPaths) {
      if (path.isPointInFill(pointObj)) {
        return path.id;
      }
    }
    return null;
  }

function updatePlayerStats() {
  document.getElementById("playerUnits").textContent = `Units: ${units.length}`;
  document.getElementById("playerGold").textContent = "Gold: 1000";
  document.getElementById("playerSteel").textContent = "Steel: 500";
  document.getElementById("playerAmmo").textContent = "Ammo: 300";
}

function updateTime() {
  const now = new Date();
  const formatted = now.toLocaleTimeString();
  document.getElementById("currentTime").textContent = `Time: ${formatted}`;
}