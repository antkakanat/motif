import "fake-indexeddb/auto";
import Dexie from "dexie";
import { unzip, zip, strFromU8, strToU8 } from "fflate";

const db = new Dexie("test");
db.version(1).stores({
  captures: 'id, type',
  collections: 'id',
  tags: 'id'
});

async function run() {
  await db.table("captures").add({ id: "1", type: "link", content: "hello" });
  console.log("Added capture");

  const captures = await db.table("captures").toArray();
  const envelope = { version: "1", captures, collections: [], tags: [] };
  
  const files = {
    "data.json": strToU8(JSON.stringify(envelope))
  };

  zip(files, (err, zipped) => {
    if (err) throw err;
    console.log("Zipped length", zipped.length);

    unzip(zipped, async (err2, unzipped) => {
      if (err2) throw err2;
      console.log("Unzipped keys", Object.keys(unzipped));

      const dataJson = strFromU8(unzipped["data.json"]);
      const parsed = JSON.parse(dataJson);

      await db.transaction("rw", db.table("captures"), db.table("collections"), db.table("tags"), async () => {
        const existingKeys = new Set(await db.table("captures").toCollection().primaryKeys());
        console.log("Existing keys inside transaction", existingKeys);
        
        const newCaptures = parsed.captures.filter((c: any) => !existingKeys.has(c.id));
        if (newCaptures.length > 0) {
          await db.table("captures").bulkAdd(newCaptures);
        }
      }).catch(e => {
        console.error("TRANSACTION ERROR", e);
      });

      console.log("Final DB size", await db.table("captures").count());
    });
  });
}

run().catch(console.error);
