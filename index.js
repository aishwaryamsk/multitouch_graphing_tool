
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


/* Multi-touch or multi-pointers */
// Preserving a pointer's event state during various event phases
// Event caches, one per touch target
let evCache = [];
let prevDiff = -1;

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
        attribute = 'chocolate';
        //attribute = 'sugarPercent';
        let currentData = groupByAttribute(dataset, attribute);
        createVisualization();
        updateVisualization(currentData);
    });

function createVisualization() {
    d3.select("#chart").attr("viewBox", [0, 0, width + margin.left + margin.right, height + margin.top + margin.bottom]);
    d3.select('#chart-content').attr("transform", "translate(" + margin.left + "," + margin.top + ")");


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

    d3.select('.x-axis').attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(xScale));


    // if the number of attributes are greater than arbitrary number 5, tilt the labels
    if (Object.keys(attrValuesCount).length > 5)
        d3.select('.x-axis').selectAll("text")
            .attr("transform", "translate(-10,0)rotate(-45)")
            .style("text-anchor", "end");

    // Update data in the visualization
    let elements = d3.selectAll(".unit-vis")
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
        .attr("y", height + margin.top + margin.bottom - 40)
        .attr("text-anchor", "middle")
        .attr("font-size", "0.9em")
    //.style("fill", 'dimgrey');


    // Enable Lasso selection for unit visualization -- for the svg and the units within it
    lasso.targetArea(d3.select('#chart'))
        .items(d3.selectAll('#chart .unit'));
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
    el.onpointermove = pointermoveHandler;

    // Use same handler for pointer{up,cancel,out,leave} events since
    // the semantics for these events - in this app - are the same.

    el.onpointerup = pointerupHandler;
    el.onpointercancel = pointerupHandler;
    el.onpointerout = pointerupHandler;
    el.onpointerleave = pointerupHandler;
}

function init() {
    setHandlers("content");
}

function pointerdownHandler(ev) {
    // The pointerdown event signals the start of a touch interaction.
    // Save this event for later processing (this could be part of a
    // multi-touch interaction) and update the background color
    ev.preventDefault();
    evCache.push(ev);
    updateBackground(ev);
}

function pointermoveHandler(ev) {
    ev.preventDefault();
    // console.log('index: ', index);
    // console.log('ev.clientX: ', ev.clientX);
    // console.log('evCache[0].clientX: ', evCache[0].clientX);
    // console.log('evCache[1].clientX: ', evCache[1].clientX);
    pinchZoom(ev)
    //updateBackground(ev);

}

function pinchZoom(ev) {
    // This function implements a 2-pointer horizontal pinch/zoom gesture.
    //
    // If the distance between the two pointers has increased (zoom in),
    // the target element's background is changed to "pink" and if the
    // distance is decreasing (zoom out), the color is changed to "lightblue".
    //
    // This function sets the target element's border to "dashed" to visually
    // indicate the pointer's target received a move event.

    // Find this event in the cache and update its record with this event
    const index = evCache.findIndex((cachedEv) => cachedEv.pointerId === ev.pointerId);
    evCache[index] = ev;

    // If two pointers are down, check for pinch gestures
    if (evCache.length === 2) {
        // Calculate the distance between the two pointers
        const curDiff = Math.abs(evCache[0].clientX - evCache[1].clientX);
        //console.log('curDiff: ', curDiff);
        if (prevDiff > 0) {
            if (curDiff > prevDiff) {
                // The distance between the two pointers has increased
                //console.log("Pinch moving OUT -> Zoom in", ev);
                ev.target.style.background = "plum";
            }
            if (curDiff < prevDiff) {
                // The distance between the two pointers has decreased
                //console.log("Pinch moving IN -> Zoom out", ev);
                ev.target.style.background = "aqua";
            }
        }

        // Cache the distance for the next move event
        prevDiff = curDiff;
    }
}


function pointerupHandler(ev) {
    // Remove this touch point from the cache and reset the target's
    // background and border
    removeEvent(ev);
    updateBackground(ev);

    // If the number of pointers down is less than two then reset diff tracker
    if (evCache.length < 2) {
        prevDiff = -1;
    }
}

function removeEvent(ev) {
    // Remove this event from the target's cache
    console.log('ev.pointerId to remove: ', ev.pointerId);
    const index = evCache.findIndex((cachedEv) => cachedEv.pointerId === ev.pointerId);

    if (index > -1)
        evCache.splice(index, 1);
}

function updateBackground(ev) {
    // Change background color based on the number of simultaneous touches/pointers
    // currently down:
    //   white - target element has no touch points i.e. no pointers down
    //   yellow - one pointer down
    //   pink - two pointers down
    //   lightblue - three or more pointers down

    switch (evCache.length) {
        //switch (ev.targetTouches.length) {
        case 0:
            // Target element has no touch points
            ev.target.style.background = "white";
            break;
        case 1:
            // Single touch point
            ev.target.style.background = "yellow";
            break;
        case 2:
            // Two simultaneous touch points
            ev.target.style.background = "pink";
            break;
        default:
            // Three or more simultaneous touches
            ev.target.style.background = "lightblue";
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

    /* the radius of possible points (which becomes selected now) will remain as 'circleRadius'.
    So, only update the radius of unselected points. */
    /* lasso.selectedItems()
        .classed("selected", true);
    lasso.notSelectedItems()
        .classed("selected", false)
        .attr('r', circleRadius); */ // reset radius of unselected points
};

function unselectPoints() {
    lasso.notSelectedItems()
        .attr('r', circleRadius); // reset radius of unselected points
}