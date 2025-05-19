import React, {useState, useRef, useMemo, forwardRef, useEffect} from 'react';
import {Box, useKeyboardControls, useGLTF} from '@react-three/drei'; 
import {RapierRigidBody, RigidBody, useRapier, useSphericalJoint} from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import * as THREE from "three";
import { Controls } from "./GameCanvas"

function BodyJoint ({bodyA, bodyB, locationA, locationB}) {

    if(!locationA || !locationB) return null;
    const joint = useSphericalJoint(bodyA, bodyB, [
    
        //XYZ joint location matrices for both object components
        locationA,  
        locationB 
    ]);
    return null;
    };

function getObjectDimensions(objectRef) {
    const obj = objectRef.current
    if (!obj) {
        return { min: [0, 0, 0], max: [0, 0, 0] }
    }
    
    // Make sure world matrices are up to date
    obj.updateMatrixWorld(true)
    
    // Compute Box3
    const box = new THREE.Box3().setFromObject(obj)
    
    // Pull out into plain arrays
    const { x: minX, y: minY, z: minZ } = box.min
    const { x: maxX, y: maxY, z: maxZ } = box.max
    
    return {
        min: [minX,minY,minZ],
        max: [maxX,maxY,maxZ],
        size: [minX - maxX, minY - maxY, minZ - maxZ]
    }
}
function jointCreator(objRefA, objRefB,jointType) { 
    //get object dimensions for both parts 
    const {minA,maxA,sizeA} = getObjectDimensions(objRefA); 
    const {minB,maxB,sizeB} = getObjectDimensions(objRefB); 

    switch(jointType){ 
        case 'neck': 
            return BodyJoint(objRefA,objRefB,minA,minB);
            break;
        case 'leftArm': 
            //blah blah 
            break;
        case 'rightArm': 
            //blah blah
            break;
        case 'leftLeg': 
            //blah blah 
            break;
        case 'rightLeg': 
            //blah blah 
            break;
        case 'tail': 
            //blahblah
            break;
        default: 
            console.log('invalid body joint type');
            break; 
    }


}

export const Dino = ({ref: bodyRef}) =>{ 

    const { scene: Body } = useGLTF('/dino_parts1/body.glb'); // path to your GLTF
    const { scene: Head } = useGLTF('/dino_parts1/head.glb');
    const headRef = useRef();
    const headMeshRef = useRef(); 

    //const { scene: LeftArm } = useGLTF('/dino_parts1/arm_left.glb');
    //const { scene: LeftLeg } = useGLTF('/dino_parts1/bodyleft_leg.glb');

    //Start movement controls 
    const [hover, setHover] = useState(false);
    const jump = () =>{
        bodyRef.current.applyImpulse({x: 0, y:10, z: 0});

        isOnFloor.current = false;
     }
    const jumpPressed = useKeyboardControls((state) => state[Controls.jump]);
    const forwardPressed = useKeyboardControls((state) => state[Controls.forward]);
    const backPressed = useKeyboardControls((state) => state[Controls.back]);
    const leftPressed = useKeyboardControls((state) => state[Controls.left]);
    const rightPressed = useKeyboardControls((state) => state[Controls.right]);
    const dir = new THREE.Vector3();
    
    const handleMovement = () => { 
        if(!isOnFloor.current){ 
            return;
        }
        dir.set(0,0,0)
        if (forwardPressed)  dir.z -= 10;
        if (backPressed)     dir.z += 10;
        if (leftPressed)     dir.x -= 10;
        if (rightPressed)    dir.x += 10;
        const vel = bodyRef.current.linvel(); // { x, y, z }

        bodyRef.current.setLinvel({x:dir.x,y:vel.y,z: dir.z},true);

    }
    //End movement controls


    //call getObjectDirections here 

    //Game Frame Loop 
    useFrame((_,delta) => { 
        if (!bodyRef.current) return;
        handleMovement() ; 
        if(jumpPressed && isOnFloor.current) { 
            jump();
            isOnFloor.current = true; 
        }         
     
            
    });

    const isOnFloor = useRef(true);

    return( 
        <>
        <RigidBody ref = {bodyRef} 
        
        position ={[2,5,0]} 
        onCollisionEnter={({other}) => { 
            if (other.rigidBodyObject.name === "floor"){isOnFloor.current = true;}
        }}
        onCollisionExit={({other}) => { 
            if (other.rigidBodyObject.name === "floor"){isOnFloor.current = false;}
        }}
        type = "dynamic"
        colliders = "hull" 
        interpolate = {true}
        >
            <primitive object = {Body} />

            {/*<meshStandardMaterial attach={"material"} color={hover? "red":"pink"} />*/}
        </RigidBody>
        <RigidBody
        
        position = {[2,6,0]}
        type = "dynamic"
        colliders = "hull"
        interpolate = {true}
        ref = {headRef}
        >
            <primitive object = {Head} ref = {headMeshRef}/>
        </RigidBody>
        {/*<jointCreator objRefA = {headMeshRef} objRefB = {bodyRef} jointType = {'neck'}/>*/}
        </>

    );
};
