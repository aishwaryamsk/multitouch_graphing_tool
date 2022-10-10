
let width;
let height;
let margin = { top: 20, right: 30, bottom: 90, left: 30 };

let x;
let y;
let attribute = null;

/* list of {data: {…}, attrs: {…}} 
* store attributes (such as color, shape, atrribute that it's grouped with etc) for each data point
*/
let dataset = [];

// settings
let duration = 1;
let circle_radius = 5;
let attrValuesCount; // keeps count of values in the grouped attribute


$(document).ready(function () {
    height = window.innerHeight - margin.top - margin.bottom;
    width = window.innerWidth - d3.select('#side-panel').node().getBoundingClientRect().width - margin.left - margin.right;
    x = d3.scaleBand();
    y = d3.scaleLinear();
});

Promise.all([d3.csv('dataset/candy-data.csv', candyRow)])
    .then(function (d) {
        dataset = setData(d[0]);
        // CHANGE LATER?: initially, use chocolate as an attribute to group on
        //attribute = 'chocolate';
        attribute = 'sugarPercent';
        let currentData = groupByAttribute(dataset, attribute);
        createVisualization();
        updateVisualization(currentData);
    });

function createVisualization() {
    d3.select("#chart").attr("viewBox", [0, 0, width + margin.left + margin.right, height + margin.top + margin.bottom]);
    d3.select('#content').attr("transform", "translate(" + margin.left + "," + margin.top + ")");
}

function updateVisualization(data) {
    console.log(Object.keys(attrValuesCount));
    x.domain(Object.keys(attrValuesCount)).range([0, width]).paddingInner(.5); // takes string as input

    // say 4 corcles in a row
    let numRowElements = 4;
    console.log(attrValuesCount);
    console.log(Math.ceil(Math.max(...Object.values(attrValuesCount)) / numRowElements));
    //y.domain([Object.keys(data)]).rangeRound([height, 0]).paddingInner(.5); // number of rows 
    y.domain([0, Math.ceil(Math.max(...Object.values(attrValuesCount)))]).range([height - 20, 0]); // number of rows 

    console.log(x('0.011'));
    console.log(x(0.011));
    console.log(y(2));

    d3.select('.x-axis').attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "translate(-10,0)rotate(-45)")
        .style("text-anchor", "end");

    let elements = d3.selectAll(".unit-vis")
        .selectAll('.unit')
        .data(data, d => d.id);

    console.log(elements);



    // update elements
    elements.transition().duration(duration)
        .attr("cx", function (d) {
            if (attribute != null) {
                return x(String(d.data[attribute]));
            }
        })
        .attr("cy", function (d) {
            if (attribute != null) {
                return y(d.attrs.groupBy.order);
            }
        });

    // add new elements
    elements.enter()
        .append("circle")
        .attr("class", "unit")
        .attr("cx", function (d) {
            //1.5*x(0)
            if (attribute != null) {
                //console.log(d);
                //console.log(d.attrs.groupBy.value);
                return x(String(d.data[attribute]));
            }
        })
        .attr("cy", function (d) {
            if (attribute != null) {
                //console.log(d);
                return y(d.attrs.groupBy.order);
            }
        })
        .attr('r', circle_radius)
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
        .attr("font-size", "0.9em");;
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
        dataPt.attrs['groupBy'] = {
            'value': attrValues.indexOf(dataPt.data[attribute]),
            'order': attrValuesCount[dataPt.data[attribute]]
        };
        attrValuesCount[dataPt.data[attribute]]++;
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