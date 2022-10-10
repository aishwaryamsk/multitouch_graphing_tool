
let width;
let height;
let margin = { top: 20, right: 20, bottom: 30, left: 20 };

let x;
let attributes = [];

/* list of {data: {…}, attrs: {…}} 
* store attributes (such as color, shape) for each data point
*/
let dataset = [];



$(document).ready(function () {
    height = window.innerHeight - margin.top - margin.bottom;
    width = window.innerWidth - d3.select('#side-panel').node().getBoundingClientRect().width - margin.left - margin.right;
    x = d3.scaleBand();
    console.log('width: ', width)
});

Promise.all([d3.csv('dataset/candy-data.csv', candyRow)])
    .then(function (d) {
        dataset = setData(d[0]);
        // CHANGE LATER?: initially, use chocolate as an attribute to group on
        attributes.push('chocolate');
        let currentData = filterByAttributes(dataset, attributes);
        createVisualization();
        updateVisualization(currentData);
    });

function createVisualization() {
    d3.select("#chart").attr("viewBox", [0, 0, width, height]);
    d3.select('#content').attr("transform", "translate(" + margin.left + "," + margin.top + ")");
}

function updateVisualization(data) {
    console.log(data);
    x.domain([Object.keys(data)]).rangeRound([0, width]).padding(.5);

}

/* Helper functions */

/* Allow users to filter by only 1 attribute at a time? */
function filterByAttributes(data, attributes) {
    // group by each value of the attribute
    subAttributes = {}; // {0: [candy1, candy2 ...], 1: [...]}
    for (let dataPt of data) {
        if (!Object.keys(subAttributes).includes(String(dataPt.data[attributes[0]]))) {
            subAttributes[dataPt.data[attributes[0]]] = [dataPt];
            //subAttributes[attributes[0]] = [dataPt.data[attributes[0]]] if dataPt.data[attributes[0]] == 1
        } else {
            subAttributes[dataPt.data[attributes[0]]].push(dataPt);
        }
    }
    return subAttributes;
}

function setData(d) {
    for (let dataPt of d) {
        dataset.push({ data: dataPt, attrs: {} });
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