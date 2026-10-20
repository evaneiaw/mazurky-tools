// checkdup.jsx — Run via File > Scripts > Other Script
var doc = app.activeDocument;
var layer = doc.layers[0];
var count = layer.pathItems.length;
var pairs = [];
var tol = 0.05;

function rnd(v) { return Math.round(v * 100) / 100; }

for (var i = 0; i < count; i++) {
    for (var j = i + 1; j < count; j++) {
        var a = layer.pathItems[i], b = layer.pathItems[j];
        if (a.pathPoints.length !== b.pathPoints.length) continue;
        if (a.closed !== b.closed) continue;
        var match = true;
        for (var k = 0; k < a.pathPoints.length; k++) {
            var dx = Math.abs(a.pathPoints[k].anchor[0] - b.pathPoints[k].anchor[0]);
            var dy = Math.abs(a.pathPoints[k].anchor[1] - b.pathPoints[k].anchor[1]);
            if (dx > tol || dy > tol) { match = false; break; }
        }
        if (match) {
            var info = "[" + (i+1) + "]vs[" + (j+1) + "] pts=" + a.pathPoints.length + " closed=" + a.closed;
            for (var k = 0; k < a.pathPoints.length; k++) {
                info += "  p" + (k+1) + "=(" + rnd(a.pathPoints[k].anchor[0]) + "," + rnd(a.pathPoints[k].anchor[1]) + ")";
            }
            pairs.push(info);
        }
    }
}

var log = "=== DUPLICATE CHECK ===\nTotal paths: " + count + "\nDuplicate pairs: " + pairs.length + "\n\n";
for (var p = 0; p < pairs.length; p++) log += pairs[p] + "\n";

var f = new File("C:/Users/user/Desktop/checkdup_result.txt");
f.open("w");
f.write(log);
f.close();
// Done
