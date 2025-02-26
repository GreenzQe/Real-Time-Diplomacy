const svgNS = "http://www.w3.org/2000/svg";
const BASE_SPEED = 1;
const WATER_MULTIPLIER = 0.5;
const ENEMY_TERRITORY_MULTIPLIER = 1 / 3;
const OWNED_TERRITORY_MULTIPLIER = 2;

let svg;
let tileStats = {};
let units = [];
let panZoomInstance;
let currentZoom = 1;
let destination = null;
let selectedUnit = null;

let currentPlayer = "Player1";
let playerAlliance = "None";
let playerGold = 1000;
let playerSteel = 500;
let playerAmmo = 300;

// List of unclaimable regions
const unclaimableRegions = ["Greenland_03", "Northwest_Territories_01", "Northwest_Territories_02", "Yakutsk_01"];

// Check if the player is logged in and set currentPlayer accordingly
const playerData = localStorage.getItem("player");
if (!playerData) {
  // Redirect to the login page if no player is stored (not logged in)
  window.location.href = "login.html";
} else {
  const player = JSON.parse(playerData);
  currentPlayer = player.username;
  // You can also set playerGold, playerSteel, playerAmmo here if desired:
  // playerGold = player.gold; playerSteel = player.steel; playerAmmo = player.ammo;
}

document.addEventListener("DOMContentLoaded", () => {
  updatePlayerStats();
  loadMapData("assets/map.json");
  setInterval(updateTime, 1000);
  // Poll the server for updated game state every 3 seconds
  setInterval(fetchGameState, 3000);
});

async function fetchGameState() {
  try {
    const response = await fetch('/api/game-state');
    const state = await response.json();
    // Update armies based on server data
    updateArmies(state.armies);
    // Update regions (like ownership) from the server
    updateRegions(state.regions);
    // (Players data can be used to update UI or for additional logic)
  } catch (error) {
    console.error("Error fetching game state:", error);
  }
}

function updateArmies(armiesData) {
  armiesData.forEach(army => {
    // Assuming army.id is unique.
    let renderedArmy = units.find(u => u.id === `${army.id}-unit`);
    if (renderedArmy) {
      // Update position from server data:
      renderedArmy.position = army.location;
      if (renderedArmy.element) {
        renderedArmy.element.setAttribute("cx", army.location.x);
        renderedArmy.element.setAttribute("cy", army.location.y);
      }
    } else {
      // Create and render a new unit if it doesn't exist already.
      // (You may want to adjust the createUnit logic to use army.id directly.)
      let newUnit = createUnit(army.id, { x: army.location.x, y: army.location.y }, 100, army.owner);
      renderUnit(newUnit);
      units.push(newUnit);
    }
  });
}

function updateRegions(regionsData) {
  regionsData.forEach(region => {
    const regionEl = document.getElementById(region.id);
    if (regionEl) {
      regionEl.setAttribute("data-owner", region.owner);
      // Update fill color based on owner.
      const newColor =
        region.owner === "Player1"
          ? "red"
          : region.owner === "Player2"
          ? "blue"
          : region.owner === "Player3"
          ? "green"
          : "gray";
      regionEl.setAttribute("fill", newColor);
      regionEl.setAttribute("data-base-color", newColor);
      // If region has a mine (for steel), you could also add an indicator
      if (region.hasMine) {
        regionEl.setAttribute("stroke", "gold"); // or another visual cue
        regionEl.setAttribute("stroke-width", "0.2");
      }
    }
  });
}

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
      window.destinationMarker = null;
    }
    if (window.destinationText) {
      window.destinationText.remove();
      window.destinationText = null;
    }
    
    // Create a small yellow dot at the destination.
    window.destinationMarker = document.createElementNS(svgNS, "circle");
    window.destinationMarker.setAttribute("cx", destination.x);
    window.destinationMarker.setAttribute("cy", destination.y);
    window.destinationMarker.setAttribute("r", 0.25);
    window.destinationMarker.setAttribute("fill", "yellow");
    svg.querySelector("#unitsGroup").appendChild(window.destinationMarker);
    
    // Calculate estimated travel time from the selected unit to the destination.
    const travelTime = calculateEstimatedTravelTime(selectedUnit.position, destination, selectedUnit);
    
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
        // Remove the incorrect call to tileStats as a function
        // tileStats(mapData);
        updatePlayerStats();
      })
      .catch(error => console.error("Error loading JSON:", error));
  }
  
  function setupEventListeners() {
    document.getElementById("createUnitBtn").addEventListener("click", () => addUnitToRegion("Jutland_01"));
    document.getElementById("tradeBtn").addEventListener("click", () => alert("Trade action triggered!"));
    document.getElementById("moveUnitBtn").addEventListener("click", handleMoveUnitBtnClick);
    document.getElementById("mapContainer").addEventListener("click", handleMapContainerClick);
    document.getElementById("closeUnitInfoBtn").addEventListener("click", deselectUnit);
    document.getElementById("captureRegionBtn").addEventListener("click", captureRegion);
    document.getElementById("switchPlayerBtn").addEventListener("click", switchPlayer);
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
        // Check if the region is unclaimable
        if (unclaimableRegions.includes(region.id)) {
          path.setAttribute("fill", "silver");
          path.setAttribute("data-owner", "Unclaimable");
        } else {
          path.setAttribute("fill", "gray");
        }
        // Store the initial base color
        path.setAttribute("data-base-color", path.getAttribute("fill"));
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
  
  // Add this function to switch the current player:
function switchPlayer() {
    currentPlayer = currentPlayer === "Player1" ? "Player2" : "Player1";
    console.log("Switched player to:", currentPlayer);
    const playerDisplay = document.getElementById("currentPlayer");
    if (playerDisplay) {
      playerDisplay.textContent = `Current Player: ${currentPlayer}`;
    }
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
  
    svg.querySelectorAll("path").forEach(region => {
      const regionId = region.id;
      region.addEventListener("mouseover", event => showTooltip(event, regionId, tooltip));
      region.addEventListener("mouseleave", () => hideTooltip(tooltip, region));
      // Add click event: only select region if no unit is selected.
      region.addEventListener("click", () => {
        if (!selectedUnit) {
          selectRegion(region);
        }
      });
    });
  }
  
  function selectRegion(regionElement) {
    // Get region info from the attributes
    const regionId = regionElement.id;
    const owner = regionElement.getAttribute("data-owner") || "Unclaimed";
    const baseColor = regionElement.getAttribute("data-base-color") || "gray";
  
    // Repurpose the unit info panel to display region information
    const unitInfoPanel = document.getElementById("unitInfoPanel");
    unitInfoPanel.style.display = "block";
    document.getElementById("unitHealth").textContent = `Region: ${regionId}`;
    document.getElementById("unitTravelTime").textContent = `Owner: ${owner}`;
    document.getElementById("unitLocation").textContent = `Base Color: ${baseColor}`;
  
    // Hide buttons that don't apply to regions
    document.getElementById("moveUnitBtn").style.display = "none";
    document.getElementById("captureRegionBtn").style.display = "none";
    document.getElementById("closeUnitInfoBtn").style.display = "inline-block";
    
    console.log(`Region ${regionId} clicked. Displaying info panel with region details.`);
  }

  function showTooltip(event, regionId, tooltip) {
    const country = event.target;
    // Use the region's base color stored in a data attribute (or fallback to gray)
    const baseColor = country.getAttribute("data-base-color") || "gray";
    // Get the current owner from the data attribute (defaulting to "Unclaimed")
    const owner = country.getAttribute("data-owner") || "Unclaimed";
    // Update tooltip text without tile stats
    tooltip.textContent = `Region ID: ${regionId}\nOwner: ${owner}`;
    tooltip.style.visibility = "visible";
    tooltip.style.left = `${event.pageX + 10}px`;
    tooltip.style.top = `${event.pageY + 10}px`;
    
    const gradientId = `gradient-${regionId}`;
    let defs = svg.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS(svgNS, "defs");
      svg.insertBefore(defs, svg.firstChild);
    }
    
    // Remove any existing gradient for this region so that the new one uses the updated base color.
    const existingGradient = document.getElementById(gradientId);
    if (existingGradient) {
      existingGradient.remove();
    }
    
    // Create the gradient using the region's current base color.
    const radialGradient = createRadialGradient(gradientId, baseColor);
    defs.appendChild(radialGradient);
    country.setAttribute("fill", `url(#${gradientId})`);
  }

  function hideTooltip(tooltip, country) {
    tooltip.style.visibility = "hidden";
    // Restore the region's fill to its base color (gray for unclaimed)
    const baseColor = country.getAttribute("data-base-color") || "gray";
    country.setAttribute("fill", baseColor);
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
      minZoom: 1,
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
    unitElement.setAttribute("r", 0.5);
    unitElement.setAttribute("fill", ownerColor);
    unitElement.setAttribute("stroke", "black");
    unitElement.setAttribute("stroke-width", "0.1");
  
    const unitsGroup = svg.querySelector("#unitsGroup");
    unitsGroup.appendChild(unitElement);
  
    unit.element = unitElement;
    unitElement.addEventListener("click", () => selectUnit(unit));
  }
  

  function addUnitToRegion(regionId, owner) {
    // Default to currentPlayer if no owner is provided.
    owner = owner || currentPlayer;
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
    if (unit.owner !== currentPlayer) {
      alert("You can only select your own units.");
      return;
    }
    
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
    updateCaptureRegionBtn();
  }
  
  function deselectUnit() {
    selectedUnit = null;
    const unitInfoPanel = document.getElementById("unitInfoPanel");
    unitInfoPanel.style.display = "none";
    document.getElementById("unitHealth").textContent = "";
    document.getElementById("unitTravelTime").textContent = "Travel Time: -";
    document.getElementById("unitLocation").textContent = "";
    document.getElementById("moveUnitBtn").style.display = "none";
    document.getElementById("closeUnitInfoBtn").style.display = "none";
    // Hide capture button when no unit is selected.
    document.getElementById("captureRegionBtn").style.display = "none";
  
    // Remove the yellow destination marker and text if they exist.
    if (window.destinationMarker) {
      window.destinationMarker.remove();
      window.destinationMarker = null;
    }
    if (window.destinationText) {
      window.destinationText.remove();
      window.destinationText = null;
    }
    
    console.log("Unit deselected.");
  }

  function moveUnitToDestination(unit, dest) {
    if (unit.owner !== currentPlayer) {
      alert("You can only move your own units.");
      return;
    }
    
    if (unit.isTraveling) {
      console.log(`Unit ${unit.id} is already moving!`);
      return;
    }
    
    // Hide the MoveUnit and CaptureRegion buttons as soon as movement begins
    document.getElementById("moveUnitBtn").style.display = "none";
    document.getElementById("captureRegionBtn").style.display = "none";
    
    if (window.destinationMarker) {
      window.destinationMarker.remove();
      window.destinationText.remove();
    }
    
    const { x: startX, y: startY } = unit.position;
    const { x: endX, y: endY } = dest;
    const dx = endX - startX;
    const dy = endY - startY;
    const totalDistance = Math.sqrt(dx * dx + dy * dy);
    
    const estimatedTravelTime = calculateEstimatedTravelTime(unit.position, dest, unit);
    console.log(`Estimated travel time for ${unit.id}: ${estimatedTravelTime.toFixed(1)}s`);
    
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
    unit.travelTime = estimatedTravelTime;
    
    const directionX = dx / totalDistance;
    const directionY = dy / totalDistance;
    
    function animate(timestamp) {
      if (!lastFrameTime) lastFrameTime = timestamp;
      const dt = (timestamp - lastFrameTime) / 1000;
      lastFrameTime = timestamp;
      
      let localSpeed = BASE_SPEED;
      if (isWater(unit.position)) {
        localSpeed *= WATER_MULTIPLIER;
      } else if (isEnemyTerritory(unit.position, unit)) {
        localSpeed *= ENEMY_TERRITORY_MULTIPLIER;
      } else if (isOwnedTerritory(unit.position, unit)) {
        localSpeed *= OWNED_TERRITORY_MULTIPLIER;
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
        // Show the MoveUnit button again
        document.getElementById("moveUnitBtn").style.display = "inline-block";
        // Update the CaptureRegion button based on the new location
        updateCaptureRegionBtn();
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

  function isEnemyTerritory(point, unit) {
    const regionId = findRegionAtPoint(point.x, point.y);
    if (!regionId) return false; // Not on any region.
    const regionEl = document.getElementById(regionId);
    const regionOwner = regionEl.getAttribute("data-owner") || "Unclaimed";
    // Territory is enemy if it’s claimed but not by this unit’s owner.
    return regionOwner !== "Unclaimed" && regionOwner !== unit.owner;
  }
  
  function isOwnedTerritory(point, unit) {
    const regionId = findRegionAtPoint(point.x, point.y);
    if (!regionId) return false;
    const regionEl = document.getElementById(regionId);
    const regionOwner = regionEl.getAttribute("data-owner") || "Unclaimed";
    return regionOwner !== "Unclaimed" && regionOwner === unit.owner;
  }

  function calculateEstimatedTravelTime(start, dest, unit, segments = 10) {
    const dx = dest.x - start.x;
    const dy = dest.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    let multiplierSum = 0;
  
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const samplePoint = {
        x: start.x + dx * t,
        y: start.y + dy * t
      };
  
      let multiplier = 1;
      if (isWater(samplePoint)) {
        multiplier = WATER_MULTIPLIER;
      } else if (isEnemyTerritory(samplePoint, unit)) {
        multiplier = ENEMY_TERRITORY_MULTIPLIER;
      } else if (isOwnedTerritory(samplePoint, unit)) {
        multiplier = OWNED_TERRITORY_MULTIPLIER;
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

  function updateCaptureRegionBtn() {
    const captureBtn = document.getElementById("captureRegionBtn");
    
    if (!selectedUnit || selectedUnit.isTraveling || selectedUnit.owner !== currentPlayer) {
      captureBtn.style.display = "none";
      return;
    }
    
    // Determine the region at the unit's position
    const regionId = findRegionAtPoint(selectedUnit.position.x, selectedUnit.position.y);
    if (!regionId) {
      captureBtn.style.display = "none";
      return;
    }
    
    const regionEl = document.getElementById(regionId);
    // Determine what the player's color should be
    const playerColor = selectedUnit.owner === "Player1" ? "red"
                      : selectedUnit.owner === "Player2" ? "blue"
                      : "gray";
    
    // Hide button if the region is already owned by the player.
    if (regionEl.getAttribute("fill") === playerColor) {
      captureBtn.style.display = "none";
      return;
    }
    
    captureBtn.style.display = "inline-block";
  }

  function captureRegion() {
    if (!selectedUnit) {
      alert("Please select a unit first.");
      return;
    }
    
    if (selectedUnit.owner !== currentPlayer) {
      alert("You can only capture a region with your own unit.");
      return;
    }
    
    if (selectedUnit.isTraveling) {
      alert("Unit is currently moving. Cannot capture region while moving.");
      return;
    }
    
    const regionId = findRegionAtPoint(selectedUnit.position.x, selectedUnit.position.y);
    if (!regionId) {
      alert("Your unit is not on a region!");
      return;
    }
    
    // Prevent capturing unclaimable regions
  if (unclaimableRegions.includes(regionId)) {
    alert("This region cannot be claimed!");
    return;
  }
    
    if (selectedUnit.health < 10) {
      alert("Not enough health to capture the region!");
      return;
    }
    
    // Deduct 10 health from the unit
    selectedUnit.health -= 10;
    document.getElementById("unitHealth").textContent = `Health: ${selectedUnit.health}`;
    
    // If health falls under 10, the unit dies.
    if (selectedUnit.health < 1) {
      killUnit(selectedUnit);
      alert(`Unit ${selectedUnit.id} has died.`);
      return;
    }
    
    // Set region color based on the capturing unit's owner.
    const regionEl = document.getElementById(regionId);
    const newColor = selectedUnit.owner === "Player1" ? "red"
                     : selectedUnit.owner === "Player2" ? "blue"
                     : "gray";
    regionEl.setAttribute("fill", newColor);
    // Update the region's base color and owning player.
    regionEl.setAttribute("data-base-color", newColor);
    regionEl.setAttribute("data-owner", selectedUnit.owner);
    
    console.log(`Region ${regionId} captured by ${selectedUnit.owner}.`);
  }

  function killUnit(unit) {
    // Remove the unit's SVG element
    if (unit.element) {
      unit.element.remove();
    }
    // Remove the unit from the units array
    units = units.filter(u => u !== unit);
    // If the killed unit was selected, deselect it
    if (selectedUnit === unit) {
      deselectUnit();
    }
    console.log(`Unit ${unit.id} has died.`);
  }

  function updatePlayerStats() {
    document.getElementById("playerUsername").textContent = `Player: ${currentPlayer}`;
    document.getElementById("playerAlliance").textContent = `Alliance: ${playerAlliance}`;
    document.getElementById("playerUnits").textContent = `Units: ${units.length}`;
    document.getElementById("playerGold").textContent = `Gold: ${playerGold}`;
    document.getElementById("playerSteel").textContent = `Steel: ${playerSteel}`;
    document.getElementById("playerAmmo").textContent = `Ammo: ${playerAmmo}`;
  }

function updateTime() {
  const now = new Date();
  const formatted = now.toLocaleTimeString();
  document.getElementById("currentTime").textContent = `Time: ${formatted}`;
}

function switchPlayer() {
    currentPlayer = currentPlayer === "Player1" ? "Player2" : "Player1";
    console.log("Switched player to:", currentPlayer);
    updatePlayerStats();
  }