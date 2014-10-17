#!/bin/sh
i=0
while [ $i -lt 50000 ]
do
echo "http://rebrickable.com/sets/$i"
curl -s http://rebrickable.com/sets/$i | grep -i "set not found"
if [ $? -ne 0 ]
then
echo $i >> list.txt
fi
i=$(($i+1))
done