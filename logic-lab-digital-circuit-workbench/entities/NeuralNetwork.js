import * as THREE from 'three';
import gsap from 'gsap';

export class NeuralNetwork {
    constructor(scene) {
        this.scene = scene;
        this.nodes = [];
        this.connections = [];
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.params = {
            count: 300,
            radius: 30,
            maxConnections: 3,
            maxDistance: 12
        };

        this.viewMode = 'cluster'; // cluster | spherical

        this.init();
    }

    init() {
        this.createNodes();
        this.createConnections();
        this.createParticles();
    }

    createNodes() {
        const geo = new THREE.SphereGeometry(0.15, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });

        for (let i = 0; i < this.params.count; i++) {
            const mesh = new THREE.Mesh(geo, mat);
            
            // Random distribution within a volume
            mesh.position.x = (Math.random() - 0.5) * this.params.radius * 2;
            mesh.position.y = (Math.random() - 0.5) * this.params.radius * 2;
            mesh.position.z = (Math.random() - 0.5) * this.params.radius * 2;

            mesh.userData = {
                originalPos: mesh.position.clone(),
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.05,
                    (Math.random() - 0.5) * 0.05,
                    (Math.random() - 0.5) * 0.05
                ),
                connections: []
            };

            this.group.add(mesh);
            this.nodes.push(mesh);
        }
    }

    createConnections() {
        const material = new THREE.LineBasicMaterial({
            color: 0x00f3ff,
            transparent: true,
            opacity: 0.2,
            blending: THREE.AdditiveBlending
        });

        // Use BufferGeometry for performance if lines were static, 
        // but we'll use a single lines system with manual updates
        const lineGeo = new THREE.BufferGeometry();
        this.linePositions = new Float32Array(this.params.count * this.params.maxConnections * 3 * 2);
        lineGeo.setAttribute('position', new THREE.BufferAttribute(this.linePositions, 3));
        
        this.linesSystem = new THREE.LineSegments(lineGeo, material);
        this.group.add(this.linesSystem);
    }

    createParticles() {
        const count = 1000;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        
        for(let i=0; i<count*3; i++) {
            pos[i] = (Math.random() - 0.5) * 150;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.1,
            transparent: true,
            opacity: 0.5
        });

        const points = new THREE.Points(geo, mat);
        this.scene.add(points);
    }

    toggleMode() {
        this.viewMode = this.viewMode === 'cluster' ? 'spherical' : 'cluster';
        
        this.nodes.forEach((node, i) => {
            let target = new THREE.Vector3();
            if (this.viewMode === 'spherical') {
                const phi = Math.acos(-1 + (2 * i) / this.params.count);
                const theta = Math.sqrt(this.params.count * Math.PI) * phi;
                target.setFromSphericalCoords(25, phi, theta);
            } else {
                target.copy(node.userData.originalPos);
            }

            gsap.to(node.position, {
                x: target.x,
                y: target.y,
                z: target.z,
                duration: 2,
                ease: "expo.out"
            });
        });
    }

    reset() {
        this.nodes.forEach(node => {
            gsap.to(node.scale, { x: 0, y: 0, z: 0, duration: 0.5, onComplete: () => {
                node.scale.set(1, 1, 1);
                node.position.copy(node.userData.originalPos);
            }});
        });
    }

    update(time, delta) {
        let lineIdx = 0;
        const positions = this.linesSystem.geometry.attributes.position.array;

        this.nodes.forEach((node, i) => {
            // Slight drift
            node.position.addScaledVector(node.userData.velocity, Math.sin(time + i) * 0.5);

            // Update connections
            let connectedCount = 0;
            for (let j = i + 1; j < this.nodes.length; j++) {
                if (connectedCount >= this.params.maxConnections) break;

                const dist = node.position.distanceTo(this.nodes[j].position);
                if (dist < this.params.maxDistance) {
                    positions[lineIdx++] = node.position.x;
                    positions[lineIdx++] = node.position.y;
                    positions[lineIdx++] = node.position.z;

                    positions[lineIdx++] = this.nodes[j].position.x;
                    positions[lineIdx++] = this.nodes[j].position.y;
                    positions[lineIdx++] = this.nodes[j].position.z;

                    connectedCount++;
                }
            }
        });

        // Zero out the rest of the lines
        while (lineIdx < positions.length) {
            positions[lineIdx++] = 0;
        }

        this.linesSystem.geometry.attributes.position.needsUpdate = true;
        this.group.rotation.y += 0.001;
    }
}