import ephem
import datetime


name = "ISS (ZARYA)";
line1 = "1 25544U 98067A   12304.22916904  .00016548  00000-0  28330-3 0  5509";
line2 = "2 25544  51.6482 170.5822 0016684 224.8813 236.0409 15.51231918798998";

tle_rec = ephem.readtle(name, line1, line2);
tle_rec.compute();

print tle_rec.sublong, tle_rec.sublat;