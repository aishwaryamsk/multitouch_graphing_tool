
let width;
let height;
let margin = { top: 20, right: 30, bottom: 90, left: 30 };

let xScale; // scale for labels on x-axis
let unitXScale; // scale for unit vis on x-axis
let unitYScale; // scale for unit vis on y-axis
let attribute = null;

/* list of {data: {…}, attrs: {…}} 
* store attributes (such as color, shape, atrribute that it's grouped with etc) for each data point
*/
let dataset = [];

// settings
let duration = 1;
let circleRadius = 7;
let attrValuesCount; // keeps count of values in the grouped attribute

// selections
let selection = []; // all selected unit vis

/* Multi-touch or multi-pointers */
// Preserving a pointer's event state during various event phases
// Event caches, one per touch target
let evCacheContent = [];
let evCacheXAxis = [];
let prevDiff = -1; // for pinch-zoom -- any direction
let onePointerTappedTwice = false;
let twoPointersTappedTwice = false;

$(document).ready(function () {
    height = window.innerHeight - margin.top - margin.bottom;
    width = window.innerWidth - d3.select('#side-panel').node().getBoundingClientRect().width - margin.left - margin.right;
    xScale = d3.scaleBand();
    unitXScale = d3.scaleLinear();
    unitYScale = d3.scaleLinear();
});

Promise.all([d3.csv('dataset/candy-data.csv', candyRow)])
    .then(function (d) {
        dataset = setData(d[0]);
        // CHANGE LATER?: initially, use chocolate as an attribute to group on
        //attribute = 'fruity';
        //attribute = 'chocolate';
        attribute = 'sugarPercent';
        let currentData = groupByAttribute(dataset, attribute);
        createVisualization();
        updateVisualization(currentData);
    });

function createVisualization() {
    d3.select("#chart").attr("viewBox", [0, 0, width + margin.left + margin.right, height + margin.top + margin.bottom])

    // create a rectangle region that allows for lasso selection  
    d3.select("#lasso-selectable-area rect")
        .attr('fill', 'transparent')
        .attr('width', width + margin.left + margin.right)
        .attr('height', margin.top + height);

    d3.select('#chart-content')
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    d3.select('#x-axis-content')
        .attr("transform", "translate(" + margin.left + "," + (margin.top + height) + ")");


}

function updateVisualization(data) {

    let unitVisPadding = 1.5; //pixels

    xScale.domain(Object.keys(attrValuesCount)).range([0, width]).paddingInner(.7).paddingOuter(0.7); // takes string as input

    /* let the number of elements per row in each column be at least 1 */
    let numRowElements = Math.floor((xScale.bandwidth() - unitVisPadding) / ((2 * circleRadius) + unitVisPadding));
    numRowElements = numRowElements > 1 ? numRowElements : 1;

    /* x-scale of the attributes */

    unitXScale.domain([0, numRowElements]);

    let maxAttributeValueCount = Math.max(...Object.values(attrValuesCount));
    let unitVisHtMargin = 10;

    /* if (numRowElements > 1) {
        let yScaleHeight = 2 * circleRadius * (maxAttributeValueCount / numRowElements) * unitVisPadding;
        unitYScale.domain([0, Math.ceil(maxAttributeValueCount / numRowElements)]).range([height - unitVisHtMargin, height - unitVisHtMargin - yScaleHeight]);
    } else {
        unitYScale.domain([1, Math.ceil(maxAttributeValueCount)]).range([height - unitVisHtMargin, 0]); // number of rows 
    } */

    let yScaleHeight = 2 * circleRadius * (maxAttributeValueCount / numRowElements) * unitVisPadding;
    unitYScale.domain([0, Math.ceil(maxAttributeValueCount / numRowElements)])
        .range([height - unitVisHtMargin, height - unitVisHtMargin - yScaleHeight]);

    // add x-axis
    d3.select('.x-axis').call(d3.axisBottom(xScale));


    // if the number of attributes are greater than arbitrary number 5, tilt the labels
    if (Object.keys(attrValuesCount).length > 5)
        d3.select('.x-axis').selectAll("text")
            .attr("transform", "translate(-10,0)rotate(-45)")
            .style("text-anchor", "end");

    // Update data in the visualization
    let elements = d3.selectAll("#chart-content .unit-vis")
        .selectAll('.unit')
        .data(data, d => d.id);

    // update elements
    elements.transition().duration(duration)
        .attr("cx", function (d) {
            if (attribute != null) {
                if (numRowElements > 1) {
                    // update the range of x-scale for unit vis to the x value of the column
                    let bandwidth = xScale.bandwidth();
                    unitXScale.range([xScale(String(d.data[attribute])),
                    xScale(String(d.data[attribute])) + bandwidth]);

                    return unitXScale((d.attrs.groupBy.order - 1) % numRowElements);
                } else return xScale(String(d.data[attribute]));
            }
        })
        .attr("cy", function (d) {
            if (attribute != null) {
                return unitYScale(Math.floor((d.attrs.groupBy.order - 1) / numRowElements));
            }
        });

    // add new elements
    elements.enter()
        .append("circle")
        .attr("class", "unit")
        .attr("cx", function (d) {
            if (attribute != null) {
                if (numRowElements > 1) {
                    // update the range of x-scale for unit vis to the x value of the column
                    bandwidth = xScale.bandwidth();
                    unitXScale.range([xScale(String(d.data[attribute])),
                    xScale(String(d.data[attribute])) + bandwidth]);

                    return unitXScale((d.attrs.groupBy.order - 1) % numRowElements);
                } else return xScale(String(d.data[attribute]));
            }
        })
        .attr("cy", function (d) {
            if (attribute != null) {
                //return unitYScale(d.attrs.groupBy.order);
                /* if (numRowElements > 1) {
                    return unitYScale(Math.floor((d.attrs.groupBy.order - 1) / numRowElements));
                } else return unitYScale(d.attrs.groupBy.order); */

                return unitYScale(Math.floor((d.attrs.groupBy.order - 1) / numRowElements));
            }
        })
        .attr('r', circleRadius)
        .style('fill', d => d.attrs.color);

    // remove elements
    elements.exit()
        .transition().duration(duration)
        .attr("r", 0)
        .remove();

    // Update x-axis label
    d3.select('#x-axis-label')
        .text(attribute)
        .attr("x", width / 2)
        .attr("y", margin.top + margin.bottom - 40)
        .attr("text-anchor", "middle")
        .attr("font-size", "0.9em")
    //.style("fill", 'dimgrey');

    // Enable Lasso selection for unit visualization -- for the svg and the units within it
    lasso.targetArea(d3.select('#lasso-selectable-area'))
        .items(d3.selectAll('#chart-content .unit'));
    d3.select("#chart").call(lasso);
}

/* Helper functions */

/* Allow users to filter by only 1 attribute at a time? */
function groupByAttribute(data, attribute) {
    // find unique attribute values
    let attrValues = [];
    for (let dataPt of data) {
        if (!attrValues.includes(dataPt.data[attribute])) {
            attrValues.push(dataPt.data[attribute]);
        }
    }
    attrValues.sort();

    // initialize counter to zero for attribute value
    attrValuesCount = {};
    for (let attr_value of attrValues) {
        attrValuesCount[attr_value] = 0;
    }

    // keep count of element's occurrence in each attribute value and store for grouping
    for (let dataPt of data) {
        attrValuesCount[dataPt.data[attribute]]++;
        dataPt.attrs['groupBy'] = {
            'column': attrValues.indexOf(dataPt.data[attribute]),
            'order': attrValuesCount[dataPt.data[attribute]]
        };
    }
    return data;
}

function setData(d) {
    let i = 0;
    for (let dataPt of d) {
        dataset.push({ id: i, data: dataPt, attrs: { color: '#0067cd' } });
        i++;
    }
    return dataset;
}

function candyRow(d) {
    return {
        candy: d['Candy'],
        chocolate: +d.Chocolate,
        fruity: +d.Fruity,
        caramel: +d.Caramel,
        peanutyAlmondy: +d['Peanuty-Almondy'],
        nougat: +d.Nougat,
        crispedRiceWafer: +d['Crisped Rice Wafer'],
        hardCandy: +d['Hard Candy'],
        barCandy: +d['Bar'],
        pluribusCandy: +d['Pluribus Candy'],
        sugarPercent: +d['Sugar Percent'],
        pricePercent: +d['Price Percent'],
        winPercent: +d['Win Percent'],
    };
};

/* 
* Register events handlers for pointers (touch, pen, mouse, etc) 
* Events: pointerdown, pointermove, pointerup (pointercancel, pointerout, pointerleave)
* Source: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Multi-touch_interaction
*/
function setHandlers(name) {
    // Install event handlers for the given element
    const el = document.getElementById(name);
    el.onpointerdown = pointerdownHandler;

    // Use same handler for pointer{up,cancel,out,leave} events since
    // the semantics for these events - in this app - are the same.
    el.onpointerup = pointerupHandler;
    el.onpointercancel = pointerupHandler;
    //el.onpointerout = pointerupHandler; // moving to descendent (unit circles) triggers pointerout 
    el.onpointerleave = pointerupHandler;

    // move handlers for different targets
    if (name === 'lasso-selectable-area')
        el.onpointermove = pinchZoomXY;
    else if (name === 'x-axis-content')
        el.onpointermove = pinchZoomX;
}

function init() {
    setHandlers("lasso-selectable-area");
    setHandlers("x-axis-content");
}

function pointerdownHandler(ev) {
    /* pointers can be: finger(s) - touch, pen, etc.
    * mouse hover won't be a pointerdown
    * mouse click counts as a pointerdown
    * */
    ev.preventDefault();
    //evCache.push(ev);
    pushEvent(ev);
    //updateBackground(ev);
    // check if this is a double tap
    doubleTapHandler(ev);
}

function doubleTapHandler(ev) {
    /* pointers can be: finger(s) - touch, pen, etc.
    * mouse hover won't be a pointerdown
    * mouse click counts as a pointerdown
    * */
    //evCache.push(ev);
    //pushEvent(ev);
    //updateBackground(ev);
    //console.log(evCacheContent)
    // detect pointer double taps on chart region
    detectOnePointerDoubleTap();
    detectTwoPointersDoubleTap();
}

function detectOnePointerDoubleTap() {
    // within 300 milli seconds of a single tap and it was not a double tap previously
    if (!onePointerTappedTwice && evCacheContent.length === 1 && !twoPointersTappedTwice) {
        onePointerTappedTwice = true;
        setTimeout(function () { onePointerTappedTwice = false; }, 300);
        return false;
    }
    // action to do on double tap
    if (onePointerTappedTwice && evCacheContent.length === 1 && !twoPointersTappedTwice) {
        // select all unit vis on single pointer double tap
        selection = d3.selectAll('#chart-content .unit')
            .classed("selected", false)
            .attr('r', circleRadius); // reset radius of unselected points;
        console.log('1 pointer double tap');

        // reset value for next double tap
        onePointerTappedTwice = false;
    }
}

function detectTwoPointersDoubleTap() {
    //console.log(evCacheContent)
    if (!twoPointersTappedTwice && evCacheContent.length === 2) {
        twoPointersTappedTwice = true;
        setTimeout(function () { twoPointersTappedTwice = false; }, 300);
        return false;
    }
    // action to do on double tap
    if (twoPointersTappedTwice && evCacheContent.length === 2) {
        console.log('two pointer double tap');
        
        // reset value for next double tap
        twoPointersTappedTwice = false;
    }
}

function pinchZoomXY(ev) {
    ev.preventDefault();
    pinchZoom(ev, 'xy')
    //updateBackground(ev);
}

function pinchZoomX(ev) {
    ev.preventDefault();
    pinchZoom(ev, 'x')
    //updateBackground(ev);
}

function pinchZoom(ev, direction) {
    // This function implements a 2-pointer horizontal pinch/zoom gesture.
    //
    // If the distance between the two pointers has increased (zoom in),
    // the target element's background is changed to "pink" and if the
    // distance is decreasing (zoom out), the color is changed to "lightblue".
    //
    // This function sets the target element's border to "dashed" to visually
    // indicate the pointer's target received a move event.

    // Find this event in the cache and update its record with this event
    const evCache = getCache(ev);
    if (evCache && evCache.length === 2) {
        const index = evCache.findIndex((cachedEv) => cachedEv.pointerId === ev.pointerId);
        evCache[index] = ev;

        // If two pointers are down, check for pinch gestures
        // Calculate the distance between the two pointers
        let curDiff = -1;
        if (direction === 'xy') {
            const x = evCache[1].clientX - evCache[0].clientX;
            const y = evCache[1].clientY - evCache[0].clientY;
            curDiff = Math.sqrt(x * x + y * y);
        } else curDiff = evCache[1].clientX - evCache[0].clientX;
        //console.log('curDiff: ', curDiff);
        if (prevDiff > 0) {
            if (curDiff > prevDiff) {
                // The distance between the two pointers has increased
                //console.log("Pinch moving OUT -> Zoom in", ev);
                ev.target.style.fill = "darkkhaki";
            }
            if (curDiff < prevDiff) {
                // The distance between the two pointers has decreased
                //console.log("Pinch moving IN -> Zoom out", ev);
                ev.target.style.fill = "aqua";
            }
        }

        // Cache the distance for the next move event
        prevDiff = curDiff;
    }
}


function pointerupHandler(ev) {
    ev.preventDefault();
    // Remove this touch point from the cache and reset the target's
    // background and border

    // // remove event only if it left its descendants too
    // let cache = getCache(ev);
    // const index = cache.findIndex((cachedEv) => cachedEv.pointerId === ev.pointerId);
    // if (index != -1)
    //     console.log('parent contains this', $(cache[index].target).has(ev.target).length)
    //if ($(cache[index].target).has(ev.target).length)

    let removedId = removeEvent(ev); // return the DOM element for which the removed event was a target of
    //updateBackground(ev);

    // If the number of pointers down is less than two then reset diff tracker
    if (removedId === 'content' && evCacheContent.length < 2) {
        prevDiff = -1;
    }
}

function getCache(ev) {
    // Return the cache for this event's target element
    //console.log($('#x-axis-content').has(ev.target).length);
    if ($('#evCacheXAxis').has(ev.target).length)
        return evCacheXAxis;
    else return evCacheContent;
}

function pushEvent(ev) {
    // Save this event in the target's cache
    const evCache = getCache(ev);
    evCache.push(ev);
}

function removeEvent(ev) {
    // Remove this event from the target's cache
    const evCache = getCache(ev);
    const index = evCache.findIndex((cachedEv) => cachedEv.pointerId === ev.pointerId);
    evCache.splice(index, 1);
    return getCache(ev);
}


function removeEvent(ev) {
    // Remove this event from the target's cache
    const evCache = getCache(ev);
    const index = evCache.findIndex((cachedEv) => cachedEv.pointerId === ev.pointerId);

    if (index > -1)
        evCache.splice(index, 1);

    console.log('pointers: ', evCacheContent.length);
    //updateBackground(ev);
}

function updateBackground(ev) {
    // Change background color based on the number of simultaneous touches/pointers
    // currently down:
    //   white - target element has no touch points i.e. no pointers down
    //   yellow - one pointer down
    //   pink - two pointers down
    //   lightblue - three or more pointers down
    const evCache = getCache(ev);
    switch (evCache.length) {
        //switch (ev.targetTouches.length) {
        case 0:
            // Target element has no touch points
            ev.target.style.fill = "white";
            break;
        case 1:
            // Single touch point
            ev.target.style.fill = "yellow";
            break;
        case 2:
            // Two simultaneous touch points
            ev.target.style.fill = "pink";
            break;
        default:
            // Three or more simultaneous touches
            ev.target.style.fill = "lightblue";
    }
}



/* Lasso functions */
let lasso = d3.lasso()
    .closePathDistance(500)
    .closePathSelect(true)
    .on("start", lassoStart)
    .on("draw", lassoDraw)
    .on("end", function () {
        lassoEnd();
        //console.log('selectedItems', lasso.selectedItems());
    });

function lassoStart() {
    lasso.items()
        .attr('r', circleRadius) // reset radius
        .classed("not_possible", true)
        .classed("selected", false);
};

function lassoDraw() {
    lasso.possibleItems()
        .classed("not_possible", false)
        .classed("possible", true)
        .attr('r', circleRadius);
    lasso.notPossibleItems()
        .classed("not_possible", true)
        .classed("possible", false)
        .attr('r', circleRadius / 2); // decrease radius of not possible points
};

function lassoEnd() {
    lasso.items()
        .classed("not_possible", false)
        .classed("possible", false);

    // if nothing is selected, keep element radius as unchanged
    if (lasso.selectedItems().size() === 0) {
        lasso.notSelectedItems()
            .classed("selected", false)
            .attr('r', circleRadius); // reset radius of unselected points
    }

    selection = lasso.selectedItems();

    /* the radius of possible points (which becomes selected now) will remain as 'circleRadius'.
    So, only update the radius of unselected points. */
    // lasso.selectedItems()
    //     .classed("selected", true);
    // lasso.notSelectedItems()
    //     .classed("selected", false)
    //     .attr('r', circleRadius); // reset radius of unselected points
};

function unselectPoints() {
    lasso.notSelectedItems()
        .attr('r', circleRadius); // reset radius of unselected points
}