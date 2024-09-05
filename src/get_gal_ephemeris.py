import ephem
import datetime
url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=galileo&FORMAT=tle"

name = "ISS (ZARYA)";
line1 = "1 37846U 11060A   24247.73900373 -.00000105  00000+0  00000+0 0  9992";
line2 = "2 37846  57.1274 359.4123 0001042  74.3951 285.6259  1.70476006 80016";

tle_rec = ephem.readtle(name, line1, line2);
tle_rec.compute();

print(tle_rec.sublong, tle_rec.sublat);
print(tle_rec.x,tle_rec.y, tle_rec.z)