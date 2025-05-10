import React, { useMemo } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function CameraRig({ targetRef, offset = [10, 2, 10], stiffness = 0.1 }) {

    const { camera } = useThree()
    // turn offset array into a Vector3 once
    const vecOffset = useMemo(() => new THREE.Vector3(...offset), [offset])
  
    useFrame(() => {
        if (targetRef.current) {

            const pos = targetRef.current.translation();
            //console.log('Cube is at', pos.x, pos.y, pos.z);
            const {x,y,z} = pos
            const posCopy = new THREE.Vector3(x,y,z);

            const desiredPos = posCopy.clone().add(vecOffset)

            camera.position.lerp(desiredPos, stiffness)
            //console.log('Cam is at', camera.position.x, camera.position.y, camera.position.z);
            
            // 4) look at the cube
            camera.lookAt(posCopy)    
        }
  });
  return null;
}