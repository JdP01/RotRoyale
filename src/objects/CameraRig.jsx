import React, { useMemo } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function CameraRig({ targetRef, offset = [10, 2, 10], stiffness = 0.1 }) {

    const { camera } = useThree()
    // turn offset array into a Vector3 once
    const vecOffset = useMemo(() => new THREE.Vector3(...offset), [offset])
    const posCopy = new THREE.Vector3(); 
    const desiredPos = posCopy.clone()
    useFrame(() => {
        if (targetRef.current) {

            const pos = targetRef.current.translation();
            //console.log('Cube is at', pos.x, pos.y, pos.z); // for testing 
            posCopy.set(pos.x,pos.y,pos.z);

            desiredPos.copy(posCopy).add(vecOffset);

            camera.position.lerp(desiredPos, stiffness)
            //console.log('Cam is at', camera.position.x, camera.position.y, camera.position.z); //for testing 
            // 4) look at the cube
            camera.lookAt(posCopy)    
        }
  });
  return null;
}