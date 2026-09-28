import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchPhiladelphiaOPA } from '../lib/property-data-providers.ts';

test('normalizes the street suffix and requires exact ZIP and address matches', async()=>{
  const old=global.fetch;
  global.fetch=async url=>{
    const q=new URL(url).searchParams.get('q');
    assert.match(q,/location = '5405 WHITBY AVE'/);
    assert.match(q,/zip_code = '19143'/);
    return Response.json({rows:[{number_of_bedrooms:3,number_of_bathrooms:1,total_livable_area:1140,year_built:'1920',category_code_description:'SINGLE FAMILY',parcel_number:'test'}]});
  };
  try {
    const result=await fetchPhiladelphiaOPA('5405 Whitby Avenue, Philadelphia, PA 19143');
    assert.equal(result.details.bedrooms,3);
    assert.equal(result.details.yearBuilt,1920);
    assert.equal(result.details.propertyType,'residential');
  } finally {global.fetch=old;}
});
test('does not match a Philadelphia street to another city',async()=>{
  assert.equal((await fetchPhiladelphiaOPA('5405 Whitby Avenue, Pittsburgh, PA 15201')).status,'not_found');
});
test('multiple parcels are not silently merged or guessed',async()=>{
  const old=global.fetch;global.fetch=async()=>Response.json({rows:[{},{}]});
  try {assert.equal((await fetchPhiladelphiaOPA('5405 Whitby Ave, Philadelphia, PA 19143')).status,'not_found');}
  finally {global.fetch=old;}
});
