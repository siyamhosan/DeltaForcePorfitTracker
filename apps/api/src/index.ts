import cluster from 'node:cluster'
import process from 'node:process'

const INSTANCE_COUNT = 2

if (cluster.isPrimary) {
  	for (let i = 0; i < INSTANCE_COUNT; i++)
    	cluster.fork()
} else {
  	await import('./server')
  	console.log(`Worker ${process.pid} started`)
}